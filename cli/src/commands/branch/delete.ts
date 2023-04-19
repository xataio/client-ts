import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import BranchDelete from '../branch/delete.js';

export default class BranchDelete extends BaseCommand<typeof BranchDelete> {
  static description = 'Delete a branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    ...BaseCommand.forceFlag()
  };

  static args = {
    branch: Args.string({ description: 'Branch name to delete', required: true })
  };

  static enableJsonFlag = true;

  static hidden = true;

  async run(): Promise<void | unknown> {
    this.warn('This command is deprecated. Please use `xata branch delete` instead.');

    const { argv } = await this.parseCommand();
    return await BranchDelete.run([...argv]);
  }
}
