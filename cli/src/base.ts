import { Command } from '@oclif/core';
import { XataApiClient } from '@xata.io/client';
import ansiRegex from 'ansi-regex';
import chalk from 'chalk';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import table from 'text-table';
import { z } from 'zod';
import { readAPIKey } from './key.js';
import { cosmiconfigSync } from 'cosmiconfig';

export const projectConfig = z.object({
  codegen: z.optional(
    z.object({
      output: z.string().optional(),
      declarations: z.boolean().optional()
    })
  )
});

export type ProjectConfig = z.infer<typeof projectConfig>;

const moduleName = 'xata';
export abstract class BaseCommand extends Command {
  // Date formatting is not consistent across locales and timezones, so we need to set the locale and timezone for unit tests.
  // By default this will use the system locale and timezone.
  locale: string | undefined = undefined;
  timeZone: string | undefined = undefined;

  projectConfig: ProjectConfig | undefined;

  // In the future we can support YAML
  searchPlaces = ['package.json', `.${moduleName}rc`, `.${moduleName}rc.json`];

  async init() {
    dotenv.config();

    const moduleName = 'xata';
    const search = cosmiconfigSync(moduleName, { searchPlaces: this.searchPlaces }).search();
    if (search) {
      const result = projectConfig.safeParse(search.config);
      if (result.success) {
        this.projectConfig = result.data;
      } else {
        this.warn(`The configuration file ${search.filepath} was found, but could not be parsed:`);

        for (const error of result.error.errors) {
          this.warn(`  [${error.code}] ${error.message} at "${error.path.join('.')}"`);
        }
      }
    }
  }

  async getXataClient(apiKey?: string | null) {
    apiKey = apiKey || (await readAPIKey());
    if (!apiKey) this.error('Could not instantiate Xata client. No API key found.'); // TODO: give suggested next steps
    return new XataApiClient({ apiKey, fetch });
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
}
