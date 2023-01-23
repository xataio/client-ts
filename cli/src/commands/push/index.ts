import { BaseCommand } from '../../base.js';

export default class Push extends BaseCommand {
  static description = 'Push local migrations to a remote Xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = [];

  async run() {}
}
