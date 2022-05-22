import { BaseCommand } from '../../base.js';

export default class DatabasesCreate extends BaseCommand {
  static description = 'Create a database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
