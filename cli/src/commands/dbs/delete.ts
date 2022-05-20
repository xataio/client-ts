import { Base } from '../../base.js';

export default class DatabasesDelete extends Base {
  static description = 'Delete a database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
