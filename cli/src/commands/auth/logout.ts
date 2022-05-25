import { BaseCommand } from '../../base.js';

export default class Logout extends BaseCommand {
  static description = 'Logout from Xata';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Branches);

    this.error('To be done');
  }
}
