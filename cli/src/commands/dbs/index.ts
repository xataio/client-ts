import { Base } from '../../base.js';

export default class Databases extends Base {
  static description = 'List, create and delete databases';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Databases);

    this.error('To be done');
  }
}
