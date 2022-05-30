import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class DatabasesList extends BaseCommand {
  static description = 'List your databases';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    workspace: Flags.string({
      description: 'Workspace id to list databases from'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<any> {
    const { flags } = await this.parse(DatabasesList);
    const workspace = flags.workspace || (await this.getWorkspace());

    const xata = await this.getXataClient();
    const databaseList = await xata.databases.getDatabaseList(workspace);
    const dbs = databaseList.databases || [];

    if (this.jsonEnabled()) return dbs;

    const headers = ['Database name', 'Created at', '# branches'];
    const rows = dbs.map((b) => [b.name, this.formatDate(b.createdAt), String(b.numberOfBranches)]);
    this.printTable(headers, rows, ['l', 'l', 'r']);
  }
}
