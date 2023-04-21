import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class BranchCreate extends BaseCommand<typeof BranchCreate> {
  static description = 'Create a branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    from: Flags.string({
      description: 'Branch name to branch off from'
    })
  };

  static args = {
    branch: Args.string({ description: 'The new branch name', required: true })
  };

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parseCommand();
    const { branch } = args;

    const { workspace, region, database } = await this.getParsedDatabaseURL(flags.db);

    const xata = await this.getXataClient();

    const { from } = flags;

    const result = await xata.api.branches.createBranch({ workspace, region, database, branch, from });

    if (this.jsonEnabled()) return result;

    const message = `Branch ${branch} successfully created`;

    this.success(message);
  }
}
