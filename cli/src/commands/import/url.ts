import { BaseCommand } from '../../base.js';

export default class ImportURLCommand extends BaseCommand {
  static description = 'Import file data into a database from a URL';

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
