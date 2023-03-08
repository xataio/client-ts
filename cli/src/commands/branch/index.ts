import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class Branch extends BaseCommand<typeof Branch> {
  static description = 'List, create, or delete branches';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to create', required: false }),
    base: Args.string({ description: 'The branch to base the new branch on', required: false })
  };

  static hidden = true;

  async run() {
    const { args, flags } = await this.parseCommand();

    const xata = await this.getXataClient();
    const { workspace, region, database } = await this.getParsedDatabaseURL(flags.db);

    const { branches } = await xata.api.branches.getBranchList({
      workspace,
      region,
      database
    });

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
