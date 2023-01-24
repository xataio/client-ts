import { BaseCommand } from '../../base.js';

export default class Pull extends BaseCommand {
  static description = 'Pull schema and migrations from a remote Xata branch and apply them locally';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = [];

  async run() {}
}
