import { Command, Flags, Interfaces } from '@oclif/core';
import {
  buildClient,
  getAPIKey,
  getBranch,
  getHostUrl,
  parseWorkspacesUrlParts,
  Schemas,
  XataApiPlugin
} from '@xata.io/client';
import { XataImportPlugin } from '@xata.io/importer';
import ansiRegex from 'ansi-regex';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { cosmiconfigSync } from 'cosmiconfig';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { readFile, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import prompts from 'prompts';
import table from 'text-table';
import which from 'which';
import { ZodError } from 'zod';
import { createAPIKeyThroughWebUI } from './auth-server.js';
import { partialProjectConfig, ProjectConfig } from './config.js';
import {
  buildProfile,
  credentialsFilePath,
  getEnvProfileName,
  Profile,
  readCredentialsDictionary
} from './credentials.js';
import { reportBugURL } from './utils.js';

export class XataClient extends buildClient({
  api: new XataApiPlugin(),
  import: new XataImportPlugin()
}) {}

export type APIKeyLocation = 'shell' | 'dotenv' | 'profile' | 'new';

const moduleName = 'xata';
const commonFlagsHelpGroup = 'Common';

export const ENV_FILES = ['.env.local', '.env'];

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<(typeof BaseCommand)['baseFlags'] & T['flags']>;
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

export abstract class BaseCommand<T extends typeof Command> extends Command {
  // Date formatting is not consistent across locales and timezones, so we need to set the locale and timezone for unit tests.
  // By default this will use the system locale and timezone.
  locale: string | undefined = undefined;
  timeZone: string | undefined = undefined;

  projectConfig?: ProjectConfig;
  projectConfigLocation?: string;

  apiKeyLocation?: APIKeyLocation;
  apiKeyDotenvLocation = '';

  #xataClient?: XataClient;

  // The first place is the one used by default when running `xata init`
  // In the future we can support YAML
  searchPlaces = [`.${moduleName}rc`, `.${moduleName}rc.json`, 'package.json'];

  static databaseURLFlag = {
    db: Flags.string({
      helpValue: 'https://{workspace}.{region}.xata.sh/db/{database}',
      description: 'URL of the database'
    })
  };

  static branchFlag = Flags.string({
    char: 'b',
    helpValue: '<branch-name>',
    description: 'Branch name to use'
  });

  static yesFlag = {
    yes: Flags.boolean({
      char: 'y',
      helpGroup: commonFlagsHelpGroup,
      description: 'Will use the default answers for any interactive question'
    })
  };

  static jsonFlag = {
    json: Flags.boolean({
      helpGroup: commonFlagsHelpGroup,
      description: 'Print the output in JSON format'
    })
  };

  // TODO: Move JSON flag to base class flags
  static commonFlags = {
    ...this.jsonFlag
  };

  static baseFlags = {
    'no-input': Flags.boolean({
      helpGroup: commonFlagsHelpGroup,
      description: 'Will not prompt interactively for missing values'
    }),
    profile: Flags.string({
      helpGroup: commonFlagsHelpGroup,
      helpValue: '<profile-name>',
      description: 'Profile name to use'
    })
  };

  static forceFlag(description?: string) {
    return {
      force: Flags.boolean({
        char: 'f',
        description: description || 'Do not ask for confirmation'
      })
    };
  }

  loadEnvFile(path: string) {
    const apiKey = process.env.XATA_API_KEY;
    let env = dotenv.config({ path });
    env = dotenvExpand.expand(env);
    if (!apiKey && env.parsed?.['XATA_API_KEY']) {
      this.apiKeyLocation = 'dotenv';
      this.apiKeyDotenvLocation = path;
    }
  }

  async init() {
    if (process.env.XATA_API_KEY) this.apiKeyLocation = 'shell';
    for (const envFile of ENV_FILES) {
      this.loadEnvFile(envFile);
    }

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

  async catch(err: Error & { exitCode?: number | undefined }): Promise<any> {
    if (err.message.match(/invalid api key/i)) {
      const profile = await this.getProfile();

      let message = '';
      let suggestions: string[] = [];
      switch (this.apiKeyLocation) {
        case 'shell':
          message = 'the API key from the shell environment variable XATA_API_KEY';
          suggestions = [
            'Make sure you invoke the CLI with a valid XATA_API_KEY environment variable',
            'Unset the XATA_API_KEY environment variable before invoking the CLI'
          ];
          break;
        case 'dotenv':
          message = `the API key from the ${this.apiKeyDotenvLocation} file`;
          suggestions = [
            `Edit the ${this.apiKeyDotenvLocation} file and set the XATA_API_KEY environment variable correctly`,
            'You can generate or regenerate API keys at https://app.xata.io/settings'
          ];
          break;
        case 'profile':
          message = `the API key from the ${profile.name} profile at ${credentialsFilePath}`;
          suggestions = [`Run ${chalk.bold('xata auth login --force')} to override the existing API key`];
          break;
        case 'new':
          message = 'a newly generated API key';
          suggestions = [
            `This is likely a bug in our end. Please report it at ${reportBugURL('Newly created API key is invalid')}`
          ];
          break;
      }
      this.error(`${err.message}, when using ${message}`, { suggestions });
    } else {
      throw err;
    }
  }

  async getProfile({ ignoreEnv = false }: { ignoreEnv?: boolean } = {}): Promise<Profile> {
    const { flags } = await this.parseCommand();
    const profileName = flags.profile || getEnvProfileName();

    const apiKey = getAPIKey();
    const useEnv = !ignoreEnv || profileName === 'default';
    if (useEnv && apiKey) return buildProfile({ name: 'default', apiKey });

    const credentials = await readCredentialsDictionary();
    const credential = credentials[profileName];
    if (credential?.apiKey) this.apiKeyLocation = 'profile';
    return buildProfile({ ...credential, name: profileName });
  }

  async getXataClient({ profile }: { profile?: Profile } = {}) {
    if (this.#xataClient) return this.#xataClient;

    const { apiKey, host } = profile ?? (await this.getProfile());

    if (!apiKey) {
      this.error('Could not instantiate Xata client. No API key found.', {
        suggestions: [
          'Run `xata auth login`',
          'Configure a project with `xata init --db=https://{workspace}.{region}.xata.sh/db/{database}`'
        ]
      });
    }

    const { flags } = await this.parseCommand();
    const databaseURL = flags.db ?? `${getHostUrl(host, 'workspaces')}/db/{database}`;
    const branch = flags.branch ?? this.getCurrentBranchName();

    this.#xataClient = new XataClient({
      databaseURL,
      branch,
      apiKey,
      fetch,
      host,
      clientName: 'cli',
      xataAgentExtra: { cliCommandId: this.id ?? 'unknown' }
    });

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

  info(message: string) {
    this.log(`${chalk.blueBright('i')} ${message}`);
  }

  success(message: string) {
    this.log(`${chalk.greenBright('✔')} ${message}`);
  }

  async verifyAPIKey(profile: Profile) {
    this.info('Checking access to the API...');
    const xata = await this.getXataClient({ profile });
    try {
      await xata.api.workspaces.getWorkspacesList();
    } catch (err) {
      return this.error(`Error accessing the API: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async getWorkspace(options: { allowCreate?: boolean } = {}) {
    const xata = await this.getXataClient();
    const workspaces = await xata.api.workspaces.getWorkspacesList();

    if (workspaces.workspaces.length === 0) {
      if (!options.allowCreate) {
        return this.error('No workspaces found, please create one first');
      }

      const { name } = await this.prompt({
        type: 'text',
        name: 'name',
        message: 'New workspace name'
      });
      if (!name) return this.error('No workspace name provided');
      const workspace = await xata.api.workspaces.createWorkspace({ body: { name } });
      return workspace.id;
    } else if (workspaces.workspaces.length === 1) {
      const workspace = workspaces.workspaces[0].id;
      this.log(`You have a single workspace, using it by default: ${workspace}`);
      return workspace;
    }

    const { workspace } = await this.prompt({
      type: 'autocomplete',
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

  async getDatabase(
    workspace: string,
    options: { allowCreate?: boolean } = {}
  ): Promise<{ name: string; region: string }> {
    const xata = await this.getXataClient();
    const { databases: dbs = [] } = await xata.api.databases.getDatabaseList({
      pathParams: { workspaceId: workspace }
    });

    if (dbs.length > 0) {
      const choices = dbs.map((db) => ({
        title: db.name,
        value: db.name
      }));

      if (options.allowCreate) {
        choices.splice(0, 0, { title: '<Create a new database>', value: 'create' });
      }

      const { database } = await this.prompt({
        type: 'autocomplete',
        name: 'database',
        message: dbs.length > 0 && options.allowCreate ? 'Select a database or create a new one' : 'Select a database',
        choices
      });
      if (!database) return this.error('No database selected');
      if (database === 'create') {
        return await this.createDatabase(workspace);
      } else {
        const result = dbs.find((db) => db.name === database);
        if (!result) return this.error('Could not find the selected database');
        return { name: result.name, region: result.region };
      }
    } else if (!options.allowCreate) {
      return this.error('No databases found, please create one first');
    } else {
      return await this.createDatabase(workspace);
    }
  }

  async getBranch(
    workspace: string,
    region: string,
    database: string,
    options: {
      allowEmpty?: boolean;
      allowCreate?: boolean;
      title?: string;
      // Branch to default if exists
      defaultBranch?: string;
    } = {}
  ): Promise<string> {
    const xata = await this.getXataClient();
    const { branches = [] } = await xata.api.branch.getBranchList({
      pathParams: { workspace, region, dbName: database }
    });

    const EMPTY_CHOICE = '$empty';
    const CREATE_CHOICE = '$create';

    if (options.defaultBranch && branches.map(({ name }) => name).includes(options.defaultBranch)) {
      return options.defaultBranch;
    }

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

      const { branch } = await this.prompt({
        type: 'autocomplete',
        name: 'branch',
        message: title,
        choices,
        initial: options.allowEmpty ? EMPTY_CHOICE : undefined
      });

      if (!branch) return this.error('No branch selected');
      if (branch === CREATE_CHOICE) {
        return this.createBranch(workspace, region, database);
      } else if (branch === EMPTY_CHOICE) {
        return '';
      } else {
        return branch;
      }
    } else if (!options.allowCreate) {
      return this.error('No branches found, please create one first');
    } else {
      return this.createBranch(workspace, region, database);
    }
  }

  async createDatabase(
    workspace: string,
    options?: { overrideName?: string; overrideRegion?: string }
  ): Promise<{ name: string; region: string }> {
    const xata = await this.getXataClient();
    const { name } = await this.prompt(
      {
        type: 'text',
        name: 'name',
        message: 'New database name',
        initial: path.parse(process.cwd()).name
      },
      options?.overrideName
    );
    if (!name) return this.error('No database name provided');

    const { regions } = await xata.api.databases.listRegions({ pathParams: { workspaceId: workspace } });
    const { region } = await this.prompt(
      {
        type: 'select',
        name: 'region',
        message: 'Select a region',
        // TODO: Get metadata and add a better title
        choices: regions.map(({ id }) => ({ title: id, value: id }))
      },
      options?.overrideRegion
    );
    if (!region) return this.error('No region selected');

    const result = await xata.api.databases.createDatabase({
      pathParams: { workspaceId: workspace, dbName: name },
      body: { region }
    });

    return { name: result.databaseName, region };
  }

  async createBranch(workspace: string, region: string, database: string): Promise<string> {
    const xata = await this.getXataClient();
    const { name } = await this.prompt({
      type: 'text',
      name: 'name',
      message: 'New branch name'
    });
    if (!name) return this.error('No branch name provided');

    const from = await this.getBranch(workspace, region, database, {
      allowCreate: false,
      allowEmpty: true,
      title: 'Select a base branch'
    });

    if (!from) {
      await xata.api.branch.createBranch({ pathParams: { workspace, region, dbBranchName: `${database}:${name}` } });
    } else {
      await xata.api.branch.createBranch({
        pathParams: { workspace, region, dbBranchName: `${database}:${name}` },
        body: { from }
      });
    }

    return name;
  }

  async getDatabaseURL(
    databaseURLFlag?: string,
    allowCreate?: boolean
  ): Promise<{ databaseURL: string; source: 'flag' | 'config' | 'env' | 'interactive' }> {
    if (databaseURLFlag) return { databaseURL: databaseURLFlag, source: 'flag' };
    if (process.env.XATA_DATABASE_URL) return { databaseURL: process.env.XATA_DATABASE_URL, source: 'env' };
    if (this.projectConfig?.databaseURL) return { databaseURL: this.projectConfig.databaseURL, source: 'config' };

    const workspace = await this.getWorkspace({ allowCreate });
    const { name: database, region } = await this.getDatabase(workspace, { allowCreate });
    const profile = await this.getProfile();
    const apiURL = getHostUrl(profile.host, 'workspaces')
      .replace('{workspaceId}', workspace)
      .replace('{region}', region);

    return { databaseURL: `${apiURL}/db/${database}`, source: 'interactive' };
  }

  async getParsedDatabaseURL(databaseURLFlag?: string, allowCreate?: boolean) {
    const { databaseURL, source } = await this.getDatabaseURL(databaseURLFlag, allowCreate);

    const info = this.parseDatabaseURL(databaseURL);
    return { ...info, source };
  }

  parseDatabaseURL(databaseURL: string) {
    const [protocol, , host] = databaseURL.split('/');
    const urlParts = parseWorkspacesUrlParts(databaseURL);
    if (!urlParts) {
      throw new Error(
        `Unable to parse workspace and region in ${databaseURL}. Please check your .xatarc file and re-run codegen before continuing. If don't know how to proceed, please contact us at support@xata.io.`
      );
    }

    const { workspace, region, database } = urlParts;

    return { databaseURL, protocol, host, database, workspace, region };
  }

  async getParsedDatabaseURLWithBranch(databaseURLFlag?: string, branchFlag?: string, allowCreate?: boolean) {
    const info = await this.getParsedDatabaseURL(databaseURLFlag, allowCreate);

    let branch = '';

    if (branchFlag) {
      branch = branchFlag;
    } else if (info.source === 'config') {
      branch = this.getCurrentBranchName();
    } else if (process.env.XATA_BRANCH !== undefined) {
      branch = process.env.XATA_BRANCH;
    } else {
      branch = await this.getBranch(info.workspace, info.region, info.database);
    }

    return { ...info, branch };
  }

  getCurrentBranchName() {
    return getBranch() ?? 'main';
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

  async obtainKey(webHost: string) {
    const { decision } = await this.prompt({
      type: 'select',
      name: 'decision',
      message: 'Do you want to use an existing API key or create a new API key?',
      choices: [
        { title: 'Create a new API key in browser', value: 'create' },
        { title: 'Use an existing API key', value: 'existing' }
      ]
    });
    if (!decision) this.exit(2);

    if (decision === 'create') {
      return createAPIKeyThroughWebUI(webHost);
    } else if (decision === 'existing') {
      const { key } = await this.prompt({
        type: 'password',
        name: 'key',
        message: 'Existing API key:'
      });
      if (!key) this.exit(2);
      return key;
    }
  }

  async deploySchema(workspace: string, region: string, database: string, branch: string, schema: Schemas.Schema) {
    const xata = await this.getXataClient();
    const compare = await xata.api.migrations.compareBranchWithUserSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { schema }
    });

    if (compare.edits.operations.length === 0) {
      this.log('Your schema is up to date');
    } else {
      this.printMigration(compare);
      this.log();

      const { confirm } = await this.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Do you want to apply the above migration into the ${branch} branch?`,
        initial: true
      });
      if (!confirm) return this.exit(1);

      await xata.api.migrations.applyBranchSchemaEdit({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: { edits: compare.edits }
      });
    }
  }

  printMigration(migration: { edits: Schemas.SchemaEditScript }) {
    for (const operation of migration.edits.operations) {
      if ('addTable' in operation) {
        this.log(` ${chalk.bgWhite.blue('CREATE table ')} ${operation.addTable.table}`);
      }

      if ('removeTable' in operation) {
        this.log(` ${chalk.bgWhite.red('DROP table ')} ${operation.removeTable.table}`);
      }

      if ('renameTable' in operation) {
        this.log(
          ` ${chalk.bgWhite.blue('RENAME table ')} ${operation.renameTable.oldName} to ${operation.renameTable.newName}`
        );
      }

      if ('addColumn' in operation) {
        this.log(
          ` ${chalk.bgWhite.blue('ADD column ')} ${operation.addColumn.table}.${operation.addColumn.column.name}`
        );
      }

      if ('removeColumn' in operation) {
        this.log(
          ` ${chalk.bgWhite.red('DROP column ')} ${operation.removeColumn.table}.${operation.removeColumn.column}`
        );
      }

      if ('renameColumn' in operation) {
        this.log(
          ` ${chalk.bgWhite.blue('RENAME column ')} ${operation.renameColumn.table}.${
            operation.renameColumn.oldName
          } to ${operation.renameColumn.newName}`
        );
      }
    }
  }

  printZodError(err: ZodError) {
    for (const error of err.errors) {
      this.warn(`  [${error.code}] ${error.message} at "${error.path.join('.')}"`);
    }
  }

  async prompt<name extends string>(
    options: prompts.PromptObject<name>,
    flagValue?: boolean | string
  ): Promise<prompts.Answers<name>> {
    // If there's a flag, use the value of the flag
    if (flagValue != null) return { [String(options.name)]: flagValue } as prompts.Answers<name>;

    const { flags } = await this.parseCommand();
    const { 'no-input': noInput, yes } = flags;

    if (yes && options.initial != null && typeof options.initial !== 'function') {
      return { [String(options.name)]: options.initial } as prompts.Answers<name>;
    }

    let reason = '';

    if (!process.stdout.isTTY && process.env.NODE_ENV !== 'test') {
      reason = 'you are not running it in a TTY';
    } else if (noInput) {
      reason = 'the --no-input flag is being used';
    }

    if (reason) {
      this.error(
        `The current command required interactivity, but ${reason}. Use --help to check if you can pass arguments instead or --yes to use the default answers for all questions.`
      );
    }

    return prompts(options);
  }

  runCommand(command: string, args: string[]) {
    this.info(`Running ${command} ${args.join(' ')}`);
    const fullPath = which.sync(command, { nothrow: true });
    if (!fullPath) {
      this.error(`Could not find binary ${command} in your PATH`);
    }
    return new Promise((resolve, reject) => {
      spawn(fullPath, args, { stdio: 'inherit', shell: true }).on('exit', (code) => {
        if (code && code > 0) return reject(new Error('Command failed'));
        resolve(undefined);
      });
    });
  }

  async parseCommand() {
    const { flags, args, argv } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict
    });

    return { flags, args, argv } as { flags: Flags<T>; args: Args<T>; argv: string[] };
  }
}
