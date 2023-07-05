import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { open } from 'fs/promises';
import { BaseCommand } from '../../base.js';

export default class ImportCSV extends BaseCommand<typeof ImportCSV> {
  static description = 'Import a CSV file';

  static examples = [
    'Import a CSV file using the column names of the CSV header',
    '$ xata import csv users.csv --table=users',
    'Specify the column names and types. They must follow the order they appear in the CSV file',
    '$ xata import csv users.csv --table=users --columns=name,email --types=string,email',
    'Create the table or any missing column if needed without asking',
    '$ xata import csv users.csv --table=users --columns=name,email --types=string,email --create'
  ];

  static flags = {
    ...this.databaseURLFlag,
    ...BaseCommand.forceFlag('Update the database schema if necessary without asking'),
    branch: this.branchFlag,
    table: Flags.string({
      description: 'The table where the CSV file will be imported to',
      required: true
    }),
    types: Flags.string({
      description: 'Column types separated by commas'
    }),
    columns: Flags.string({
      description: 'Column names separated by commas'
    }),
    'no-header': Flags.boolean({
      description: 'Specify that the CSV file has no header'
    }),
    create: Flags.boolean({
      description: "Whether the table or columns should be created if they don't exist without asking"
    }),
    'no-column-name-normalization': Flags.boolean({
      description: 'Avoid changing column names in a normalized way'
    }),
    'batch-size': Flags.integer({
      description: 'Batch size to process and upload records'
    }),
    'max-rows': Flags.integer({
      description: 'Maximum number of rows to process'
    }),
    delimiter: Flags.string({
      description: 'Delimiter to use for splitting CSV data'
    }),
    'null-value': Flags.string({
      description: 'Value to use for null values',
      multiple: true
    })
  };

  static args = {
    file: Args.string({ description: 'The file to be imported', required: true })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parseCommand();
    const { file } = args;
    const {
      table,
      'no-header': noHeader,
      create,
      'no-column-name-normalization': noColumnNameNormalization,
      'batch-size': batchSize,
      'max-rows': limit,
      delimiter,
      'null-value': nullValues
    } = flags;
    const header = !noHeader;
    let columns = flagsToColumns(flags);

    const csvOptions = {
      delimiter,
      header,
      nullValues,
      columns,
      limit
    };

    const getFileStream = async () => (await open(file, 'r')).createReadStream();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    const xata = await this.getXataClient();

    const existingTable = await xata.import.findTable({ workspace, region, database, branch, table });
    if (existingTable) {
      throw new Error(`Table ${table} already exists. Only imports to new tables are supported`);
    }
    const parseStream = await getFileStream();
    const parseResults = (
      await xata.import.parseCsvStream({
        fileStream: parseStream,
        parserOptions: { ...csvOptions, limit: 1000 }
      })
    ).results;
    parseStream.close();
    if (!parseResults.success) {
      throw new Error(`Failed to parse CSV file ${parseResults.errors.join(' ')}`);
    }
    if (!columns) {
      columns = parseResults.columns;
    }

    // schema edit APIs?
    // compare branch with user schema
    // apply edits
    // https://github.com/xataio/client-ts/pull/1035/files#diff-ed4fa305f46a5c6cae3a02562f34b8eb6d05d90cb530f0d7846c324a0d8acdea
    await xata.api.tables.createTable({ workspace, region, database, branch, table });

    for (const column of columns) {
      await xata.api.tables.addTableColumn({
        workspace,
        region,
        database,
        branch,
        table,
        column
      });
    }

    let importSuccessCount = 0;
    let importErrorCount = 0;
    const fileStream = await getFileStream();
    await xata.import.parseCsvStreamBatches({
      fileStream: fileStream,
      fileSizeBytes: (await (await open(file, 'r')).stat()).size,
      parserOptions: { ...csvOptions, columns },
      batchRowCount: 1000,
      onBatch: async (parseResults, meta) => {
        if (!parseResults.success) {
          throw new Error('Failed to parse CSV file');
        }
        const dbBranchName = `${database}:${branch}`;
        const importResult = await xata.import.importBatch(
          // @ts-ignore
          { dbBranchName: dbBranchName, region, workspace: workspace, database },
          { columns: parseResults.columns, table, batch: parseResults }
        );
        importSuccessCount += importResult.successful.results.length;
        if (importResult.errors) {
          importErrorCount += importResult.errors.length;
        }
        this.info(
          `${importSuccessCount} rows successfully imported ${importErrorCount} errors. ${Math.floor(
            meta.estimatedProgress * 100
          )}% complete`
        );
      }
    });
    fileStream.close();
    this.success('Completed');
    process.exit(0);
  }
}

const flagsToColumns = (flags: {
  types: string | undefined;
  columns: string | undefined;
}): Schemas.Column[] | undefined => {
  if (!flags.columns && !flags.types) return undefined;
  if (flags.columns && !flags.types) {
    throw new Error('Must specify types when specifying columns');
  }
  if (!flags.columns && flags.types) {
    throw new Error('Must specify columns when specifying types');
  }
  const columns = splitCommas(flags.columns);
  const types = splitCommas(flags.types);
  if (columns?.length !== types?.length) {
    throw new Error('Must specify same number of columns and types');
  }
  return columns.map((name, i) => {
    // probably should assert the type here :\
    const type = types[i] as Schemas.Column['type'];
    return { name, type };
  });
};

export function splitCommas(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim());
}
