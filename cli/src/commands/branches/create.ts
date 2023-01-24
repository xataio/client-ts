import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { createBranch, currentGitBranch, defaultGitBranch, isGitInstalled, isWorkingDirClean } from '../../git.js';

export default class BranchesCreate extends BaseCommand {
  static description = 'Create a branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    from: Flags.string({
      description: 'Branch name to branch off from'
    }),
    'no-git': Flags.boolean({
      description: 'Disable git integration'
    })
  };

  static args = [{ name: 'branch', description: 'The new branch name', required: true }];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parse(BranchesCreate);
    const { branch } = args;

    const { workspace, region, database } = await this.getParsedDatabaseURL(flags.db);

    const xata = await this.getXataClient();

    const { 'no-git': noGit, from } = flags;
    const useGit = !noGit;

    if (useGit) {
      if (!isGitInstalled()) {
        this.error(
          'Git cannot be found. Please install it or use the --no-git flag to disable integrating xata branches with git branches.'
        );
      }
      try {
        if (!isWorkingDirClean()) {
          this.error(
            'The working directory has uncommited changes. Please commit or stash them before creating a branch. Or use the --no-git flag to disable integrating xata branches with git branches.'
          );
        }

        const currentBranch = currentGitBranch();
        if (currentBranch !== branch) {
          const { branch: gitBase } = from
            ? await xata.api.branches.resolveBranch({ workspace, region, database, gitBranch: from })
            : { branch: defaultGitBranch() };

          createBranch(branch, gitBase);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('not a git repository')) {
          this.error(
            'The working directory is not under git version control. Please initialize or clone a git repository or use the --no-git flag to disable integrating xata branches with git branches.'
          );
        } else {
          throw err;
        }
      }
    }

    const result = await xata.api.branches.createBranch({ workspace, region, database, branch, from });

    if (this.jsonEnabled()) return result;

    let message = `Branch ${branch} successfully created`;
    if (useGit) {
      message = `${message}. A new git branch with the same name has been created and is your current branch.`;
    }

    this.success(message);
  }
}
