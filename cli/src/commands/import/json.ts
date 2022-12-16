import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import JSON5 from 'json5';
import { BaseCommand } from '../../base.js';

export default class ImportCSV extends BaseCommand {
  static description = 'Import a CSV file';

  static examples = [
    'Import a JSON file',
    '$ xata import json users.json --table=users',
    'Specify "-" as file name to use the stdin to read the data from',
    chalk.dim('$ command-that-outputs-json | xata import json - --table=users --create')
  ];

  static flags = {
    ...this.noInputFlag,
    ...this.databaseURLFlag,
    ...BaseCommand.forceFlag('Update the database schema if necessary without asking'),
    branch: this.branchFlag,
    table: Flags.string({
      description: 'The table where the CSV file will be imported to',
      required: true
    })
  };

  static args = [{ name: 'file', description: 'The file to be imported' }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(ImportCSV);
    const { file } = args;
    const { table } = flags;

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);

    const xata = await this.getXataClient();

    try {
      const contents = await readFile(file, 'utf-8');

      const records = JSON5.parse(contents);

      await xata.records.bulkInsertTableRecords({ workspace, region, database, branch, table, records });

      this.success('Finished importing data');
    } catch (error) {
      this.error('Unable to import data');
    }
  }
}
