import { BaseCommand } from '../../base.js';

export default class BranchesCreate extends BaseCommand {
  static description = 'Create a branch';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
