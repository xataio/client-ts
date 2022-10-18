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
    const { workspace, region, database } = await this.getParsedDatabaseURL(flags.db);
    const branch = args.branch;

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'text',
        name: 'confirm',
        message: `Are you sure you want to delete the branch ${database}:${branch} in the ${workspace} workspace? Please type ${branch} to confirm`,
        initial: false
      },
      flags.force ? branch : undefined
    );
    if (!confirm) return this.exit(1);
    if (confirm !== branch) return this.error('The branch name did not match');

    await xata.branches.deleteBranch({ workspace, region, database, branch });

    if (this.jsonEnabled()) return {};

    this.success(`Branch ${database}:${branch} in the ${workspace} workspace successfully deleted`);
  }
}
