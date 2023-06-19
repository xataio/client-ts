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
    const { encoding, delimiter, header, skipEmptyLines, nullValues, quoteChar, escapeChar, newline, commentPrefix } =
      flags;

    if (!isFileEncoding(encoding)) {
      this.error(`Invalid encoding: ${encoding}`);
    }

    const xata = await this.getXataClient();

    const fileNames = glob.sync(args.files);

    const file = fileNames[0];
    const fileDescriptor = await open(file, 'r');
    const fileStream = fileDescriptor.createReadStream({ encoding });
    // let rows: unknown[] = [];
    let rowCount = 0;
    const { columns } = await xata.import.parseCsvFileStream({
      fileStream,
      parserOptions: {
        delimiter,
        header,
        skipEmptyLines,
        nullValues,
        quoteChar,
        escapeChar,
        newline: newline as any,
        commentPrefix
      },
      chunkRowCount: 1000,
      onChunk: async (parseResults) => {
        if (!parseResults.success) {
          throw new Error('Failed to parse CSV file');
        }
        await xata.import.importBatch(
          { dbBranchName: this.getCurrentBranchName(), region: 'eu-west-1', workspace: await this.getWorkspace() },
          // columns repeated here:
          { columns: parseResults.columns, table: 'table-1', batch: parseResults }
        );
        console.log('before rowCount', rowCount);
        // console.log('parseResults', parseResults);
        if (parseResults.success) {
          rowCount += parseResults.data.length;
          console.log('rowCount', rowCount);
          // rows = rows.concat(parseResults.data);
        }
      }
    });
    console.log('columns', columns);
    console.log('row count', rowCount);
    // console.log('rows', rows);

    // await xata.import.importStream({ batchSize: 1000, onBatchProcessed: () => null, getNextRows, columns });
    // this.log(
    //   JSON.stringify({ delimiter, header, skipEmptyLines, nullValues, quoteChar, escapeChar, newline, commentPrefix })
    // );

    this.log(JSON.stringify(flags));
  }
}
