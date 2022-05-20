import { Base } from '../../base.js';

export default class Init extends Base {
  static description = 'Initialize a database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Init);

    this.error('To be done');
  }
}
