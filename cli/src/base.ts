import { Command } from '@oclif/core';
import table from 'text-table';
import dotenv from 'dotenv';
import ansiRegex from 'ansi-regex';
import chalk from 'chalk';

export abstract class Base extends Command {
  async init() {
    dotenv.config();
  }

  printTable(headers: string[], rows: string[][], align?: table.Options['align']) {
    const boldHeaders = headers.map((h) => chalk.bold(h));
    console.log(
      table([boldHeaders].concat(rows), { align, stringLength: (s: string) => s.replace(ansiRegex(), '').length })
    );
  }

  formatDate(date: string) {
    return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
