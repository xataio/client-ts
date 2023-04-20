import { BaseCommand } from '../../base.js';

export default class BranchesList extends BaseCommand<typeof BranchesList> {
  static description = 'List branches';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {};

  static enableJsonFlag = true;

  async run(): Promise<any> {
    const { flags } = await this.parseCommand();
    const { workspace, region, database } = await this.getParsedDatabaseURL(flags.db);

    const xata = await this.getXataClient();
    const { branches } = await xata.api.branches.getBranchList({ workspace, region, database });

    if (this.jsonEnabled()) return branches;

    this.printTable(
      ['Name', 'Created at'],
      branches.map((b) => [b.name, this.formatDate(b.createdAt)])
    );
  }
}
