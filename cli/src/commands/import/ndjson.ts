import { BaseCommand } from '../../base.js';

export default class ImportNDJSONCommand extends BaseCommand {
  static description = 'Import NDJSON data into a database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag
  };

  static args = [];

  async run(): Promise<void> {
    const xata = this.getXataClient();

    console.log(xata);
  }
}
