import prompts from 'prompts';
import { BaseCommand } from '../../base.js';

export default class BranchesDelete extends BaseCommand {
  static description = 'Delete a branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    databaseURL: this.databaseURLFlag
  };

  static args = [{ name: 'branch', description: 'Branch name to delete', required: true }];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags, args } = await this.parse(BranchesDelete);
    const { workspace, database } = await this.getParsedDatabaseURL(flags.databaseURL);
    const branch = args.branch;

    const xata = await this.getXataClient();

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete the branch ${database}:${branch} in the ${workspace} workspace?`,
      initial: true
    });
    if (!confirm) return this.exit(1);

    await xata.branches.deleteBranch(workspace, database, branch);

    if (this.jsonEnabled()) return {};

    this.log(`Branch ${database}:${branch} in the ${workspace} workspace successfully deleted`);
  }
}
