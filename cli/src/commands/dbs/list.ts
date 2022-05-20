import { Flags } from '@oclif/core';
import { Base } from '../../base.js';
import { getXataClient } from '../../client.js';
import { parseDatabaseURL } from '../../defaults.js';

export default class DatabasesList extends Base {
  static description = 'List your databases';

  static examples = [];

  static flags = {
    workspace: Flags.string({
      description: 'Workspace id to list databases from'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<any> {
    const { flags } = await this.parse(DatabasesList);
    const defaults = parseDatabaseURL();
    const workspace = flags.workspace || defaults.workspace;

    if (!workspace)
      return this.error('Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.');

    const xata = await getXataClient(this);
    const databaseList = await xata.databases.getDatabaseList(workspace);
    const dbs = databaseList.databases || [];

    if (this.jsonEnabled()) return dbs;

    const headers = ['Database name', 'Created at', '# branches'];
    const rows = dbs.map((b) => [b.name, this.formatDate(b.createdAt), String(b.numberOfBranches)]);
    this.printTable(headers, rows, ['l', 'l', 'r']);
  }
}
