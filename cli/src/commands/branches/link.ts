import { Flags } from '@oclif/core';
import { getCurrentBranchDetails } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import { defaultGitBranch, isGitInstalled } from '../../git.js';
import fetch from 'node-fetch';

export default class BranchesCreate extends BaseCommand {
  static description = 'Link a git branch with a xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    databaseURL: this.databaseURLFlag,
    gitBranch: Flags.string({
      name: 'git',
      description: 'Git branch name'
    }),
    xataBranch: Flags.string({
      name: 'xata',
      description: 'Xata branch name'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags } = await this.parse(BranchesCreate);

    if (!isGitInstalled()) {
      this.error('Git cannot be found. Please install it to link branches.');
    }

    const { workspace, database, databaseURL } = await this.getParsedDatabaseURL(flags.databaseURL);

    const xata = await this.getXataClient();

    try {
      // TODO Not sure about these default flags
      const { gitBranch = defaultGitBranch(), xataBranch = await getCurrentBranchName(databaseURL) } = flags;
      if (!xataBranch) {
        this.error('Could not resolve the current branch');
      }

      const result = await xata.databases.addGitBranchesEntry(workspace, database, { gitBranch, xataBranch });

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

async function getCurrentBranchName(databaseURL: string) {
  const branchDetails = await getCurrentBranchDetails({ fetchImpl: fetch, databaseURL });
  return branchDetails?.branchName;
}
