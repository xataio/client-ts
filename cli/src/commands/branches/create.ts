import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { parseDatabaseURL } from '../../defaults.js';

export default class BranchesCreate extends BaseCommand {
  static description = 'Create a branch';

  static examples = [];

  static flags = {
    workspace: Flags.string({
      description: 'Workspace id the database belongs to'
    }),
    database: Flags.string({
      description: 'Database the branch will belongs to'
    }),
    from: Flags.string({
      description: 'Branch name to branch off from'
    })
  };

  static args = [{ name: 'branch', description: 'The new branch name', required: true }];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parse(BranchesCreate);
    const { branch } = args;

    const defaults = parseDatabaseURL();
    const workspace = flags.workspace || defaults.workspace;
    const database = flags.database || defaults.database;

    if (!workspace) {
      return this.error('Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.');
    }
    if (!database) {
      return this.error('Could not find database name. Please set XATA_DATABASE_URL or use the --database flag.');
    }
    if (!branch) {
      return this.error('Please, specify a branch name');
    }

    const xata = await this.getXataClient();

    const result = await xata.branches.createBranch(workspace, database, branch, flags.from);

    if (this.jsonEnabled()) return result;

    this.log(`Branch ${branch} successfully created`);
  }
}
