import { BaseCommand } from '../../base.js';

export default class BranchesDelete extends BaseCommand {
  static description = 'Delete a branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    ...BaseCommand.forceFlag()
  };

  static args = [{ name: 'branch', description: 'Branch name to delete', required: true }];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags, args } = await this.parse(BranchesDelete);
    const { workspace, database } = await this.getParsedDatabaseURL(flags.db);
    const branch = args.branch;

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete the branch ${database}:${branch} in the ${workspace} workspace?`,
        initial: false
      },
      flags.force
    );
    if (!confirm) return this.exit(1);

    await xata.branches.deleteBranch(workspace, database, branch);

    if (this.jsonEnabled()) return {};

    this.log(`Branch ${database}:${branch} in the ${workspace} workspace successfully deleted`);
  }
}
