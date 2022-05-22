import { BaseCommand } from '../../base.js';

export default class BranchesDelete extends BaseCommand {
  static description = 'Delete a branch';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
