import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class Branch extends BaseCommand<typeof Branch> {
  static description = 'List, create, or delete branches';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    delete: Flags.string({
      description: 'Delete a remote branch',
      char: 'D'
    })
  };

  static args = {
    branch: Args.string({ description: 'The branch to create', required: false }),
    base: Args.string({ description: 'The branch to base the new branch on', required: false })
  };

  async run() {
    const { args, flags } = await this.parseCommand();

    const xata = await this.getXataClient();
    const { workspace, region, database } = await this.getParsedDatabaseURL(flags.db);

    const { branches } = await xata.api.branches.getBranchList({
      workspace,
      region,
      database
    });

    if (flags.delete && !args.branch && !args.base) {
      const { confirm } = await this.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Do you want to delete ${flags.delete} branch?`,
        initial: false
      });
      if (!confirm) return;

      await xata.api.branches.deleteBranch({
        workspace,
        region,
        database,
        branch: flags.delete
      });
    } else if (flags.delete) {
      this.error(`Unable to delete branch ${flags.delete}, more than 1 parameter parsed`);
    }

    if (args.branch) {
      const branch = branches.find((branch) => branch.name === args.branch);
      if (branch) {
        this.log(`Branch ${branch.name} already exists`);
      } else {
        await xata.api.branches.createBranch({
          workspace,
          region,
          database,
          branch: args.branch,
          from: args.base ?? 'main'
        });
        this.log(`Branch ${args.branch} created`);
      }

      return;
    }

    if (this.jsonEnabled()) return branches;

    const rows = branches.map((b) => [b.name, this.formatDate(b.createdAt)]);
    this.printTable(['Name', 'Created at'], rows);
  }
}
