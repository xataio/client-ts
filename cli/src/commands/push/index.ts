import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class Push extends BaseCommand {
  static description = 'Push local migrations to a remote Xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    'dry-run': Flags.boolean({
      description: "Show what would be pushed, but don't actually push",
      default: false
    })
  };

  static args = [
    {
      name: 'branch',
      description: 'The remote branch to push to',
      required: false
    }
  ];

  static hidden = true;

  async run() {
    // Nothing to see here, move along
  }
}
