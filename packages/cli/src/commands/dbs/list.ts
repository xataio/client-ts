import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class DatabasesList extends BaseCommand<typeof DatabasesList> {
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
    const { flags } = await this.parseCommand();
    const workspace =
      flags.workspace ||
      this.parseDatabaseURL(this.projectConfig?.databaseURL ?? '').workspace ||
      (await this.getWorkspace());

    const xata = await this.getXataClient();
    const { databases: dbs = [] } = await xata.api.databases.getDatabaseList({
      pathParams: { workspaceId: workspace }
    });

    if (this.jsonEnabled()) return dbs;

    const headers = ['Database name', 'Created at'];
    const rows = dbs.map((b) => [b.name, this.formatDate(b.createdAt)]);
    this.printTable(headers, rows, ['l', 'l', 'r']);
  }
}
