import { Base } from '../../base.js';

export default class Schema extends Base {
  static description = 'View and edit the schema of the current database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Schema);

    this.error('To be done');
  }
}
