import { Flags } from '@oclif/core';
import open from 'open';
import { BaseCommand } from '../../base.js';
import { getProfile } from '../../credentials.js';
export default class Browse extends BaseCommand {
  static description = 'Open the current database in the browser';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    databaseURL: this.databaseURLFlag,
    branch: Flags.string({
      description: 'Branch to be browsed'
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Browse);
    const base = (await getProfile())?.web || 'https://app.xata.io';

    const { workspace, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.databaseURL, flags.branch);

    await open(`${base}/workspaces/${workspace}/dbs/${database}/branches/${branch}`);
  }
}
