import { Command, Flags } from '@oclif/core';
import { BooleanFlag } from '@oclif/core/lib/interfaces';
import { XataApiClient } from '@xata.io/client';
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
import { z } from 'zod';
import { readAPIKey } from './key.js';

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

  // In the future we can support YAML
  searchPlaces = ['package.json', `.${moduleName}rc`, `.${moduleName}rc.json`];

  static databaseURLFlag = Flags.string({
    name: 'databaseurl',
    description: 'URL of the database in the format https://{workspace}.xata.sh/db/{database}'
  });

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

        for (const error of result.error.errors) {
          this.warn(`  [${error.code}] ${error.message} at "${error.path.join('.')}"`);
        }
      }
    }
  }

  async getXataClient(apiKey?: string | null) {
    if (this.#xataClient) return this.#xataClient;

    apiKey = apiKey || (await readAPIKey());
    if (!apiKey) this.error('Could not instantiate Xata client. No API key found.'); // TODO: give suggested next steps
    this.#xataClient = new XataApiClient({ apiKey, fetch });
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
      this.log(`You only have a workspace, using it by default: ${workspace}"`);
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
        choices.splice(0, 0, { title: 'Create a new database', value: 'create' });
      }

      const { database } = await prompts({
        type: 'select',
        name: 'database',
        message: dbs.length > 0 && options.allowCreate ? 'Select a database or create a new one' : 'Select a database',
        choices
      });
      if (!database) return this.error('No database selected');
      if (database !== 'create') return database;
    } else if (!options.allowCreate) {
      return this.error('No databases found, please create one first');
    } else {
      const { name } = await prompts({
        type: 'text',
        name: 'name',
        message: 'New database name',
        initial: path.parse(process.cwd()).name
      });
      if (!name) return this.error('No database name provided');

      await xata.databases.createDatabase(workspace, name);

      return name.name;
    }
  }

  async getDatabaseURL(databaseURLFlag?: string, allowCreate?: boolean) {
    if (databaseURLFlag) return databaseURLFlag;
    if (this.projectConfig?.databaseURL) return this.projectConfig.databaseURL;
    if (process.env.XATA_DATABASE_URL) return process.env.XATA_DATABASE_URL;

    const workspace = await this.getWorkspace({ allowCreate });
    const database = await this.getDatabase(workspace, { allowCreate });
    return `https://${workspace}.xata.sh/db/${database}`;
  }

  async getParsedDatabaseURL(databaseURLFlag?: string, allowCreate?: boolean) {
    const databaseURL = await this.getDatabaseURL(databaseURLFlag, allowCreate);

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

  static commonFlags = {
    json: Flags.boolean({
      description: 'Print the output in JSON format'
    }),
    'no-input': Flags.boolean({
      description: 'Will not prompt interactively for missing values'
    })
  };
}
