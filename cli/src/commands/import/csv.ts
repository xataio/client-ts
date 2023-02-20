import { Args } from '@oclif/core';
import { readFile } from 'fs/promises';
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

    const filenames = glob.sync(args.files);
    const files = await Promise.all(filenames.map((filename) => readFile(filename, { encoding })));

    const payload = await xata.import.file({
      files,
      parserOptions: {
        csv: {
          delimiter,
          header,
          skipEmptyLines,
          nullValues,
          quoteChar,
          escapeChar,
          newline: newline as any,
          commentPrefix
        }
      }
    });

    this.log(
      JSON.stringify({ delimiter, header, skipEmptyLines, nullValues, quoteChar, escapeChar, newline, commentPrefix })
    );

    this.log(JSON.stringify(payload));
  }
}
