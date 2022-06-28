import { Command, Flags } from '@oclif/core';
import { getCurrentBranchName, Schemas, XataApiClient, XataApiClientOptions } from '@xata.io/client';
import ansiRegex from 'ansi-regex';
import chalk from 'chalk';
import { cosmiconfigSync } from 'cosmiconfig';
import dotenv from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import prompts from 'prompts';
import slugify from 'slugify';
import table from 'text-table';
import { z, ZodError } from 'zod';
import { createAPIKeyThroughWebUI } from './auth-server.js';
import { getProfile } from './credentials.js';

export const projectConfigSchema = z.object({
  databaseURL: z.string(),
  codegen: z.object({
    output: z.string(),
    declarations: z.boolean()
  })
});

const partialProjectConfig = projectConfigSchema.deepPartial();

export type ProjectConfig = z.infer<typeof partialProjectConfig>;

const moduleName = 'xata';
export abstract class BaseCommand extends Command {
  // Date formatting is not consistent across locales and timezones, so we need to set the locale and timezone for unit tests.
  // By default this will use the system locale and timezone.
  locale: string | undefined = undefined;
  timeZone: string | undefined = undefined;

  projectConfig?: ProjectConfig;
  projectConfigLocation?: string;

  #xataClient?: XataApiClient;

  // The first place is the one used by default when running `xata init`
  // In the future we can support YAML
  searchPlaces = [`.${moduleName}rc`, `.${moduleName}rc.json`, 'package.json'];

  static databaseURLFlag = {
    db: Flags.string({
      helpValue: 'https://{workspace}.xata.sh/db/{database}',
      description: 'URL of the database in the format https://{workspace}.xata.sh/db/{database}'
    })
  };

  static branchFlag = Flags.string({
    char: 'b',
    description: 'Branch name to use'
  });

  static noInputFlag = Flags.boolean({
    description: 'Will not prompt interactively for missing values'
  });

  static jsonFlag = Flags.boolean({
    description: 'Print the output in JSON format'
  });

  static commonFlags = {
    json: this.jsonFlag,
    'no-input': this.noInputFlag
  };

  async init() {
    dotenv.config();

    const moduleName = 'xata';
    const search = cosmiconfigSync(moduleName, { searchPlaces: this.searchPlaces }).search();
    if (search) {
      const result = partialProjectConfig.safeParse(search.config);
      if (result.success) {
        this.projectConfig = result.data;
        this.projectConfigLocation = search.filepath;
      } else {
        this.warn(`The configuration file ${search.filepath} was found, but could not be parsed:`);
        this.printZodError(result.error);
      }
    }
  }

  async getXataClient(apiKey?: string | null) {
    if (this.#xataClient) return this.#xataClient;

    const profile = apiKey ? undefined : await getProfile();

    apiKey = apiKey || profile?.apiKey;
    if (!apiKey) {
      this.error('Could not instantiate Xata client. No API key found.', {
        suggestions: [
          'Run `xata auth login`',
          'Configure a project with `xata init --databaseURL=https://{workspace}.xata.sh/db/{database}`'
        ]
      });
    }

    let host: XataApiClientOptions['host'];
    if (profile?.api) {
      if (profile.api === 'staging') {
        host = 'staging';
      } else {
        host = {
          main: profile.api,
          workspaces: profile.api
        };
      }
    }
    this.#xataClient = new XataApiClient({ apiKey, fetch, host });
    return this.#xataClient;
  }

  printTable(headers: string[], rows: string[][], align?: table.Options['align']) {
    const boldHeaders = headers.map((h) => chalk.bold(h));
    console.log(
      table([boldHeaders].concat(rows), { align, stringLength: (s: string) => s.replace(ansiRegex(), '').length })
    );
  }

  formatDate(date: string) {
    return new Date(date).toLocaleString(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.timeZone
    });
  }

  async verifyAPIKey(key: string) {
    this.log('Checking access to the API...');
    const xata = await this.getXataClient(key);
    try {
      await xata.workspaces.getWorkspacesList();
    } catch (err) {
      return this.error(`Error accessing the API: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async getWorkspace(options: { allowCreate?: boolean } = {}) {
    const xata = await this.getXataClient();
    const workspaces = await xata.workspaces.getWorkspacesList();

    if (workspaces.workspaces.length === 0) {
      if (!options.allowCreate) {
        return this.error('No workspaces found, please create one first');
      }

      const { name } = await prompts({
        type: 'text',
        name: 'name',
        message: 'New workspace name'
      });
      if (!name) return this.error('No workspace name provided');
      const workspace = await xata.workspaces.createWorkspace({ name, slug: slugify(name) });
      return workspace.id;
    } else if (workspaces.workspaces.length === 1) {
      const workspace = workspaces.workspaces[0].id;
      this.log(`You only have a workspace, using it by default: ${workspace}`);
      return workspace;
    }

    const { workspace } = await prompts({
      type: 'select',
      name: 'workspace',
      message: 'Select a workspace',
      choices: workspaces.workspaces.map((workspace) => ({
        title: workspace.name,
        description: workspace.id,
        value: workspace.id
      }))
    });
    if (!workspace) return this.error('No workspace selected');

    return String(workspace);
  }

  async getDatabase(workspace: string, options: { allowCreate?: boolean } = {}) {
    const xata = await this.getXataClient();
    const databases = await xata.databases.getDatabaseList(workspace);
    const dbs = databases.databases || [];

    if (dbs.length > 0) {
      const choices = dbs.map((db) => ({
        title: db.name,
        value: db.name
      }));

      if (options.allowCreate) {
        choices.splice(0, 0, { title: '<Create a new database>', value: 'create' });
      }

      const { database } = await prompts({
        type: 'select',
        name: 'database',
        message: dbs.length > 0 && options.allowCreate ? 'Select a database or create a new one' : 'Select a database',
        choices
      });
      if (!database) return this.error('No database selected');
      if (database === 'create') {
        return this.createDatabase(workspace);
      } else {
        return database;
      }
    } else if (!options.allowCreate) {
      return this.error('No databases found, please create one first');
    } else {
      return this.createDatabase(workspace);
    }
  }

  async getBranch(
    workspace: string,
    database: string,
    options: { allowEmpty?: boolean; allowCreate?: boolean; title?: string } = {}
  ): Promise<string> {
    const xata = await this.getXataClient();
    const { branches = [] } = await xata.branches.getBranchList(workspace, database);

    const EMPTY_CHOICE = '$empty';
    const CREATE_CHOICE = '$create';

    if (branches.length > 0) {
      const choices = branches.map((db) => ({
        title: db.name,
        value: db.name
      }));

      if (options.allowEmpty) {
        choices.splice(0, 0, { title: '<None>', value: EMPTY_CHOICE });
      }

      if (options.allowCreate) {
        choices.splice(0, 0, { title: '<Create a new branch>', value: CREATE_CHOICE });
      }

      const {
        title = branches.length > 0 && options.allowCreate ? 'Select a branch or create a new one' : 'Select a branch'
      } = options;

      const { branch } = await prompts({ type: 'select', name: 'branch', message: title, choices });

      if (!branch) return this.error('No branch selected');
      if (branch === CREATE_CHOICE) {
        return this.createBranch(workspace, database);
      } else if (branch === EMPTY_CHOICE) {
        return '';
      } else {
        return branch;
      }
    } else if (!options.allowCreate) {
      return this.error('No branches found, please create one first');
    } else {
      return this.createBranch(workspace, database);
    }
  }

  async createDatabase(workspace: string) {
    const xata = await this.getXataClient();
    const { name } = await prompts({
      type: 'text',
      name: 'name',
      message: 'New database name',
      initial: path.parse(process.cwd()).name
    });
    if (!name) return this.error('No database name provided');

    await xata.databases.createDatabase(workspace, name);

    return name;
  }

  async createBranch(workspace: string, database: string): Promise<string> {
    const xata = await this.getXataClient();
    const { name } = await prompts({
      type: 'text',
      name: 'name',
      message: 'New branch name'
    });
    if (!name) return this.error('No branch name provided');

    const from = await this.getBranch(workspace, database, {
      allowCreate: false,
      allowEmpty: true,
      title: 'Select a base branch'
    });

    if (!from) {
      await xata.branches.createBranch(workspace, database, name);
    } else {
      await xata.branches.createBranch(workspace, database, name, from);
    }

    return name;
  }

  async getDatabaseURL(
    databaseURLFlag?: string,
    allowCreate?: boolean
  ): Promise<{ databaseURL: string; source: 'flag' | 'config' | 'env' | 'interactive' }> {
    if (databaseURLFlag) return { databaseURL: databaseURLFlag, source: 'flag' };
    if (this.projectConfig?.databaseURL) return { databaseURL: this.projectConfig.databaseURL, source: 'config' };
    if (process.env.XATA_DATABASE_URL) return { databaseURL: process.env.XATA_DATABASE_URL, source: 'env' };

    const workspace = await this.getWorkspace({ allowCreate });
    const database = await this.getDatabase(workspace, { allowCreate });
    return { databaseURL: `https://${workspace}.xata.sh/db/${database}`, source: 'interactive' };
  }

  async getParsedDatabaseURL(databaseURLFlag?: string, allowCreate?: boolean) {
    const { databaseURL, source } = await this.getDatabaseURL(databaseURLFlag, allowCreate);

    const info = this.parseDatabaseURL(databaseURL);
    return {
      ...info,
      source
    };
  }

  parseDatabaseURL(databaseURL: string) {
    const [protocol, , host, , database] = databaseURL.split('/');
    const [workspace] = (host || '').split('.');
    return {
      databaseURL,
      protocol,
      host,
      database,
      workspace
    };
  }

  async getParsedDatabaseURLWithBranch(databaseURLFlag?: string, branchFlag?: string, allowCreate?: boolean) {
    const info = await this.getParsedDatabaseURL(databaseURLFlag, allowCreate);
    const profile = await getProfile();

    let branch = '';

    if (branchFlag) {
      branch = branchFlag;
    } else if (info.source === 'config') {
      // TODO: pass host information
      branch = await getCurrentBranchName({
        fetchImpl: fetch,
        databaseURL: info.databaseURL,
        apiKey: profile?.apiKey ?? undefined
      });
    } else if (process.env.XATA_BRANCH !== undefined) {
      branch = process.env.XATA_BRANCH;
    } else {
      branch = await this.getBranch(info.workspace, info.database);
    }

    return { ...info, branch };
  }

  async updateConfig() {
    const fullPath = this.projectConfigLocation;
    if (!fullPath) return this.error('Could not update config file. No config file found.');

    const filename = path.parse(fullPath).base;
    if (filename === 'package.json') {
      const content = JSON.parse(await readFile(fullPath, 'utf8'));
      content.xata = this.projectConfig;
      await writeFile(fullPath, JSON.stringify(content, null, 2));
    } else {
      await writeFile(fullPath, JSON.stringify(this.projectConfig, null, 2));
    }
  }

  async obtainKey() {
    const { decision } = await prompts({
      type: 'select',
      name: 'decision',
      message: 'Do you want to use an existing API key or create a new API key?',
      choices: [
        { title: 'Create a new API key opening a browser', value: 'create' },
        { title: 'Existing API key', value: 'existing' }
      ]
    });
    if (!decision) this.exit(2);

    if (decision === 'create') {
      return createAPIKeyThroughWebUI();
    } else if (decision === 'existing') {
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'Introduce your API key:'
      });
      if (!key) this.exit(2);
      return key;
    }
  }

  async deploySchema(workspace: string, database: string, branch: string, schema: Schemas.Schema) {
    const xata = await this.getXataClient();
    const plan = await xata.branches.getBranchMigrationPlan(workspace, database, branch, schema);

    const { newTables, removedTables, renamedTables, tableMigrations } = plan.migration;

    function isEmpty(obj?: object) {
      if (obj == null) return true;
      if (Array.isArray(obj)) return obj.length === 0;
      return Object.keys(obj).length === 0;
    }

    if (isEmpty(newTables) && isEmpty(removedTables) && isEmpty(renamedTables) && isEmpty(tableMigrations)) {
      this.log('Your schema is up to date');
    } else {
      this.printMigration(plan.migration);
      this.log();

      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `Do you want to apply the above migration into the ${branch} branch?`,
        initial: true
      });
      if (!confirm) return this.exit(1);

      await xata.branches.executeBranchMigrationPlan(workspace, database, branch, plan);
    }
  }

  printMigration(migration: Schemas.BranchMigration) {
    if (migration.title) {
      this.log(`* ${migration.title} [status: ${migration.status}]`);
    }
    if (migration.id) {
      this.log(`ID: ${migration.id}`);
    }
    if (migration.lastGitRevision) {
      this.log(`git commit sha: ${migration.lastGitRevision}`);
      if (migration.localChanges) {
        this.log(' + local changes');
      }
      this.log();
    }
    if (migration.createdAt) {
      this.log(`Date ${this.formatDate(migration.createdAt)}`);
    }

    if (migration.newTables) {
      for (const tableName of Object.keys(migration.newTables)) {
        this.log(` ${chalk.bgWhite.blue('CREATE table ')} ${tableName}`);
      }
    }

    if (migration.removedTables) {
      for (const tableName of migration.removedTables) {
        this.log(` ${chalk.bgWhite.red('DELETE table ')} ${tableName}`);
      }
    }

    if (migration.renamedTables) {
      for (const renamedTable of migration.renamedTables) {
        this.log(` ${chalk.bgWhite.blue('RENAME table ')} ${renamedTable.oldName} to ${renamedTable.newName}`);
      }
    }

    if (migration.tableMigrations) {
      for (const [tableName, tableMigration] of Object.entries(migration.tableMigrations)) {
        this.log();
        this.log(`Table ${tableName}:`);
        if (tableMigration.newColumns) {
          for (const columnName of Object.keys(tableMigration.newColumns)) {
            this.log(` ${chalk.bgWhite.blue('ADD column ')} ${columnName}`);
          }
        }
        if (tableMigration.removedColumns) {
          for (const columnName of tableMigration.removedColumns) {
            this.log(` ${chalk.bgWhite.red('DELETE column ')} ${columnName}`);
          }
        }
        if (tableMigration.modifiedColumns) {
          for (const columnMigration of tableMigration.modifiedColumns) {
            this.log(` ${chalk.bgWhite.red('MODIFY column ')} ${columnMigration.old.name}`);
          }
        }
      }
    }
  }

  printZodError(err: ZodError) {
    for (const error of err.errors) {
      this.warn(`  [${error.code}] ${error.message} at "${error.path.join('.')}"`);
    }
  }
}
