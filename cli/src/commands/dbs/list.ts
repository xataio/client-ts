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

  static args = {};

  static enableJsonFlag = true;

  async run(): Promise<any> {
    const { flags } = await this.parse(DatabasesList);
    const workspace =
      flags.workspace ||
      this.parseDatabaseURL(this.projectConfig?.databaseURL ?? '').workspace ||
      (await this.getWorkspace());

    const xata = await this.getXataClient();
    const { databases: dbs = [] } = await xata.database.getDatabaseList({ workspace });

    if (this.jsonEnabled()) return dbs;

    const headers = ['Database name', 'Created at'];
    const rows = dbs.map((b) => [b.name, this.formatDate(b.createdAt)]);
    this.printTable(headers, rows, ['l', 'l', 'r']);
  }
}
