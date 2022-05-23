import { Command } from '@oclif/core';
import { XataApiClient } from '@xata.io/client';
import ansiRegex from 'ansi-regex';
import chalk from 'chalk';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import table from 'text-table';
import { readAPIKey } from './key.js';

export abstract class BaseCommand extends Command {
  locale: string | undefined = undefined;
  timeZone: string | undefined = undefined;

  async init() {
    dotenv.config();
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
