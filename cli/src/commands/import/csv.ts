import { Args } from '@oclif/core';
import { open } from 'fs/promises';
import glob from 'glob';
import { BaseCommand } from '../../base.js';
import { isFileEncoding } from '../../utils/files.js';
import { commonImportFlags, csvFlags } from '../../utils/importer.js';

export default class ImportCSV extends BaseCommand<typeof ImportCSV> {
  static description = 'Import a CSV file';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    ...commonImportFlags(),
    ...csvFlags('')
  };

  static args = {
    files: Args.string({ description: 'Files to upload', required: true })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parseCommand();
    const {
      table,
      encoding,
      delimiter,
      header,
      skipEmptyLines,
      nullValues,
      quoteChar,
      escapeChar,
      newline,
      commentPrefix
    } = flags;

    const csvOptions = {
      delimiter,
      header,
      skipEmptyLines,
      nullValues,
      quoteChar,
      escapeChar,
      newline: newline as any,
      commentPrefix
    };

    if (!isFileEncoding(encoding)) {
      this.error(`Invalid encoding: ${encoding}`);
    }
    const getFileStream = async () => (await open(file, 'r')).createReadStream({ encoding });
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    const xata = await this.getXataClient();

    const fileNames = glob.sync(args.files);
    const file = fileNames[0];

    const existingTable = await xata.import.findTable({ workspace, region, database, branch, table });
    if (existingTable) {
      throw new Error(`Table ${table} already exists. Only imports to new tables are supported`);
    }
    const parseResults = await xata.import.parseCsvFileStreamSync({
      fileStream: await getFileStream(),
      parserOptions: { ...csvOptions, limit: 1000 }
    });
    if (!parseResults.success) {
      throw new Error(`Failed to parse CSV file ${parseResults.errors.join(' ')}`);
    }
    await xata.api.tables.createTable({ workspace, region, database, branch, table });
    const { columns } = parseResults;
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

    let rowCount = 0;
    await xata.import.parseCsvFileStream({
      fileStream: await getFileStream(),
      parserOptions: { ...csvOptions, columns },
      chunkRowCount: 1000,
      onChunk: async (parseResults) => {
        if (!parseResults.success) {
          throw new Error('Failed to parse CSV file');
        }
        const dbBranchName = `${database}:${branch}`;
        await xata.import.importBatch(
          // @ts-ignore
          { dbBranchName: dbBranchName, region, workspace: workspace, database },
          { columns: parseResults.columns, table, batch: parseResults }
        );
        if (parseResults.success) {
          rowCount += parseResults.data.length;
          console.log('rowCount', rowCount);
          // rows = rows.concat(parseResults.data);
        }
      }
    });
    // console.log('columns', columns);
    // console.log('row count', rowCount);
    // // console.log('rows', rows);

    // // await xata.import.importStream({ batchSize: 1000, onBatchProcessed: () => null, getNextRows, columns });
    // // this.log(
    // //   JSON.stringify({ delimiter, header, skipEmptyLines, nullValues, quoteChar, escapeChar, newline, commentPrefix })
    // // );

    // this.log(JSON.stringify(flags));
  }
}
