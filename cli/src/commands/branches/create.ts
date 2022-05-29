import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { createBranch, defaultGitBranch, isGitInstalled, isWorkingDirClean } from '../../git.js';
export default class BranchesCreate extends BaseCommand {
  static description = 'Create a branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    databaseURL: this.databaseURLFlag,
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

    if (!branch) {
      return this.error('Please, specify a branch name');
    }

    const { workspace, database } = await this.getParsedDatabaseURL(flags.databaseURL);

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
      } catch (err) {
        if (err instanceof Error && err.message.includes('not a git repository')) {
          this.error(
            'The working directory is not under git version control. Please initialize or clone a git repository or use the --no-git flag to disable integrating xata branches with git branches.'
          );
        } else {
          throw err;
        }
      }
      // TODO calculate associated git branch with `from` xata branch
      const gitBase = from || defaultGitBranch();
      createBranch(branch, gitBase);
    }

    const result = await xata.branches.createBranch(workspace, database, branch, from);

    if (this.jsonEnabled()) return result;

    let message = `Branch ${branch} successfully created`;
    if (useGit) {
      message = `${message}. A new git branch with the same name has been created and is your current branch.`;
    }

    this.log(message);
  }
}
