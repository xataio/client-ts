import { BaseCommand } from '../../base.js';

export default class Diff extends BaseCommand {
  static description = 'Compare two local or remote branches';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = [];

  async run() {}
}
