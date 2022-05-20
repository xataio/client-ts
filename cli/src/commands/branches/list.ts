import { Flags } from '@oclif/core';
import { Base } from '../../base.js';
import { getXataClient } from '../../client.js';
import { parseDatabaseURL } from '../../defaults.js';

export default class BranchesList extends Base {
  static description = 'List branches';

  static examples = [];

  static flags = {
    workspace: Flags.string({
      description: 'Workspace id to list branches from'
    }),
    database: Flags.string({
      description: 'Database name to list branches from'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<any> {
    const { flags } = await this.parse(BranchesList);
    const defaults = parseDatabaseURL();
    const workspace = flags.workspace || defaults.workspace;
    const database = flags.database || defaults.database;

    if (!workspace)
      return this.error('Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.');
    if (!database)
      return this.error('Could not find database name. Please set XATA_DATABASE_URL or use the --database flag.');

    const xata = await getXataClient(this);
    const branches = await xata.branches.getBranchList(workspace, database);

    if (this.jsonEnabled()) return branches.branches;

    const rows = branches.branches.map((b) => [b.name, this.formatDate(b.createdAt)]);
    this.printTable(['Name', 'Created at'], rows);
  }
}
