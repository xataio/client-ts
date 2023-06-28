import open from 'open';
import { BaseCommand } from '../../base.js';

export default class Browse extends BaseCommand<typeof Browse> {
  static description = 'Open the current database in the browser';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    branch: this.branchFlag
  };

  static args = {};

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();
    const base = (await this.getProfile())?.web || 'https://app.xata.io';

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);

    await open(`${base}/workspaces/${workspace}/dbs/${database}:${region}/branches/${branch}`);
  }
}
