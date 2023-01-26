import { BaseCommand } from '../../base.js';

export default class Branch extends BaseCommand {
  static description = 'Checkout a remote branch or create a new local branch';

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
