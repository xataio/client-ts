import { Flags } from '@oclif/core';
import { readFile } from 'fs/promises';
import glob from 'glob';
import { BaseCommand } from '../../base.js';
import { isFileEncoding } from '../../utils/files.js';

export default class ImportCSVCommand extends BaseCommand {
  static description = 'Import CSV data into a database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    encoding: Flags.string({
      description: 'Encoding of the CSV file',
      default: 'utf8' as const
    })
  };

  static args = [{ name: 'files', description: 'Files to upload', required: true }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(ImportCSVCommand);
    const { encoding } = flags;

    if (!isFileEncoding(encoding)) {
      this.error(`Invalid encoding: ${encoding}`);
    }

    const xata = await this.getXataClient();

    const filenames = glob.sync(args.files);
    const files = await Promise.all(filenames.map((filename) => readFile(filename, { encoding })));

    const payload = await xata.import.file({ files });

    this.log(JSON.stringify(payload, null, 2));
  }
}
