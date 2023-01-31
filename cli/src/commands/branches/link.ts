import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { currentGitBranch, isGitInstalled } from '../../git.js';

export default class BranchesCreate extends BaseCommand {
  static description = 'Link a git branch with a xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    git: Flags.string({
      description: 'Git branch name'
    }),
    xata: Flags.string({
      description: 'Xata branch name'
    })
  };

  static args = {};

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags } = await this.parse(BranchesCreate);

    if (!isGitInstalled()) {
      this.error('Git cannot be found. Please install it to link branches.');
    }

    const { workspace, region, database } = await this.getParsedDatabaseURL(flags.db);

    const xata = await this.getXataClient();

    try {
      const {
        git: gitBranch = currentGitBranch(),
        xata: xataBranch = await this.getBranch(workspace, region, database, { allowCreate: true })
      } = flags;

      if (!gitBranch) {
        this.error('Could not resolve the current git branch');
      } else if (!xataBranch) {
        this.error('Could not resolve the xata branch');
      }

      const result = await xata.branches.addGitBranchesEntry({ workspace, region, database, gitBranch, xataBranch });

      if (this.jsonEnabled()) return result;

      this.log(`Branch ${gitBranch} successfully linked with ${xataBranch}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not a git repository')) {
        this.error(
          'The working directory is not under git version control. Please initialize or clone a repository to link branches.'
        );
      } else {
        throw err;
      }
    }
  }
}
