import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { currentGitBranch, isGitInstalled } from '../../git.js';

export default class BranchesCreate extends BaseCommand {
  static description = 'Unlink a git branch with a xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    git: Flags.string({
      description: 'Git branch name'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags } = await this.parse(BranchesCreate);

    if (!isGitInstalled()) {
      this.error('Git cannot be found. Please install it to unlink a branch.');
    }

    const { workspace, database } = await this.getParsedDatabaseURL(flags.db);

    const xata = await this.getXataClient();

    try {
      const { git: gitBranch = currentGitBranch() } = flags;
      if (!gitBranch) {
        this.error('Could not resolve the current git branch');
      }

      const result = await xata.branches.removeGitBranchesEntry(workspace, database, gitBranch);

      if (this.jsonEnabled()) return result;

      this.log(`Branch ${gitBranch} successfully unlinked`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not a git repository')) {
        this.error(
          'The working directory is not under git version control. Please initialize or clone a repository to unlink a branch.'
        );
      } else {
        throw err;
      }
    }
  }
}
