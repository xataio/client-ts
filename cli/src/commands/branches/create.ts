import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import BranchCreate from '../branch/create.js';

export default class BranchesCreate extends BaseCommand<typeof BranchCreate> {
  static description = 'Create a branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    from: Flags.string({
      description: 'Branch name to branch off from'
    })
  };

  static args = {
    branch: Args.string({ description: 'The new branch name', required: true })
  };

  static enableJsonFlag = true;

  static hidden = true;

  async run(): Promise<void | unknown> {
    this.warn('This command is deprecated. Please use `xata branch create` instead.');

    const { argv } = await this.parseCommand();
    return BranchCreate.run([...argv]);
  }
}
