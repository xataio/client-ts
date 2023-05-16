import { Args, Flags } from '@oclif/core';
import { PAGINATION_MAX_SIZE, SelectableColumn, XataRecord } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import Papa from 'papaparse';

export default class ExportCSV extends BaseCommand<typeof ExportCSV> {
  static description = 'Export a CSV file';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    ...BaseCommand.forceFlag('Overwrite the CSV file if it already exists'),
    branch: this.branchFlag,
    table: Flags.string({
      description: 'The table where the CSV file will be imported to'
    }),
    columns: Flags.string({
      description: 'Column names to export separated by commas'
    }),
    'no-header': Flags.boolean({
      description: 'Specify that the CSV file has no header'
    }),
    delimiter: Flags.string({
      description: 'Delimiter to use for splitting CSV data'
    }),
    'null-value': Flags.string({
      description: 'Value to use for null values'
    }),
    'batch-size': Flags.integer({
      description: 'Batch size to process and upload records'
    })
  };

  static args = {
    file: Args.string({ description: 'The file to be exported', required: true })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parseCommand();
    const { file } = args;
    const {
      table,
      columns: columnString,
      'no-header': noHeader,
      delimiter,
      'null-value': nullValue,
      'batch-size': batchSize = PAGINATION_MAX_SIZE
    } = flags;

    const { workspace, region, database, branch, databaseURL } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      flags.branch
    );

    const xata = await this.getXataClient({ databaseURL, branch });
    const { schema } = await xata.api.branches.getBranchDetails({ workspace, region, database, branch });

    for (const table of schema.tables) {
      const columns = ['id', ...table.columns.map((column) => column.name)];
      for await (const page of xata.db[table.name].getIterator({ batchSize })) {
        const records = page.map((record) => record.toSerializable());
        const csv = Papa.unparse(records, {
          header: !noHeader,
          delimiter,
          columns
        });

        console.log(csv);
      }
    }

    this.success('Finished exporting data');
  }
}
