import { Command, Flags } from '@oclif/core';
import { getCurrentBranchName } from '@xata.io/client';
import { parseDatabaseURL } from '../../defaults.js';
import open from 'open';
export default class Browse extends Command {
  static description = 'Open the current database in the browser';

  static examples = [];

  static flags = {
    branch: Flags.string({
      description: 'Branch to be browsed'
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Browse);

    const { workspace, database } = parseDatabaseURL();
    const branch = flags.branch || (await getCurrentBranchName());

    if (!workspace) {
      return this.error('Could not find workspace id. Please set XATA_DATABASE_URL.');
    }
    if (!database) {
      return this.error('Could not find database name. Please set XATA_DATABASE_URL.');
    }

    await open(`https://app.xata.io/workspaces/${workspace}/dbs/${database}/branches/${branch}`);
  }
}
