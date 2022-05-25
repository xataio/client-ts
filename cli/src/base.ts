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

export const userConfig = z.object({
  codegen: z.optional(
    z.object({
      output: z.string()
    })
  )
});

export type UserConfig = z.infer<typeof userConfig>;

export abstract class BaseCommand extends Command {
  // Date formatting is not consistent across locales and timezones, so we need to set the locale and timezone for unit tests.
  // By default this will use the system locale and timezone.
  locale: string | undefined = undefined;
  timeZone: string | undefined = undefined;

  userConfig: UserConfig | undefined;

  async init() {
    dotenv.config();

    const search = cosmiconfigSync('xata').search();
    if (search) {
      const result = userConfig.safeParse(search.config);
      if (result.success) {
        this.userConfig = result.data;
      } else {
        this.warn(`The configuration file ${search.filepath} was found, but could not be parsed:`);

        for (const error of result.error.errors) {
          this.warn(`  [${error.code}] ${error.message} at "${error.path.join('.')}"`);
        }
      }
    }
  }

  async getXataClient() {
    const apiKey = await readAPIKey();
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
}
