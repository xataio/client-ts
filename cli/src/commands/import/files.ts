import { BaseCommand } from '../../base.js';
import { commonImportFlags, csvFlags } from '../../utils/importer.js';

export default class ImportFileCommand extends BaseCommand {
  static description = 'Import file data into a database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    ...commonImportFlags(),
    ...csvFlags('csv')
  };

  static args = [];

  async run(): Promise<void> {
    const xata = await this.getXataClient();

    console.log(xata);
  }
}
