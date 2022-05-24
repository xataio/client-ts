import { Flags } from '@oclif/core';
import { getCurrentBranchName, getDatabaseURL } from '@xata.io/client';
import prompts from 'prompts';
import { BaseCommand } from '../../base.js';
import { parseDatabaseURL } from '../../defaults.js';

export default class BranchesDelete extends BaseCommand {
  static description = 'Delete a branch';

  static examples = [];

  static flags = {
    workspace: Flags.string({
      description: 'Workspace id the database to delete belongs to'
    }),
    database: Flags.string({
      description: 'Database name the branch to delete belongs to'
    }),
    branch: Flags.string({
      description: 'Branch name to delete'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags } = await this.parse(BranchesDelete);
    const databaseURL = getDatabaseURL();
    const defaults = parseDatabaseURL(databaseURL);
    const workspace = flags.workspace || defaults.workspace;
    const database = flags.database || defaults.database;
    const branch = flags.branch || (await this.getBranchName(databaseURL));

    if (!workspace)
      return this.error('Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.');
    if (!database)
      return this.error('Could not find database name. Please set XATA_DATABASE_URL or use the --database flag.');
    if (!branch)
      return this.error('Could not find branch name. Either set up a git repository or use the --branch flag.');

    const xata = await this.getXataClient();

    const result = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete the branch ${database}:${branch} in the ${workspace} workspace?`,
      initial: true
    });
    if (!result.confirm) return this.exit(1);

    await xata.branches.deleteBranch(workspace, database, branch);

    if (this.jsonEnabled()) return {};

    this.log(`Branch ${database}:${branch} in the ${workspace} workspace successfully deleted`);
  }

  async getBranchName(databaseURL?: string) {
    try {
      return await getCurrentBranchName({ databaseURL });
    } catch (err) {
      // Ignore
    }
  }
}
