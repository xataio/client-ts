import { BaseCommand } from '../../base.js';

export default class ImportJSONCommand extends BaseCommand<typeof ImportJSONCommand> {
  static description = 'Import JSON data into a database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag
  };

  static args = {};

  async run(): Promise<void> {
    const xata = this.getXataClient();

    console.log(xata);
  }
}
