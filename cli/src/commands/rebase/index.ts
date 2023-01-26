import { BaseCommand } from '../../base.js';

export default class Rebase extends BaseCommand {
  static description = 'Rebase current branch with another branch';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = [];

  static hidden = true;

  async run() {
    // Nothing to see here, move along
  }
}
