import { BaseCommand } from '../../base.js';

export default class Status extends BaseCommand {
  static description = 'Check status of the auth settings';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Branches);

    this.error('To be done');
  }
}
