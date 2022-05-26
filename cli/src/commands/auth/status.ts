import { BaseCommand } from '../../base.js';
import { readAPIKeyFromFile } from '../../key.js';

export default class Status extends BaseCommand {
  static description = 'Check status of the auth settings';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    const existingKey = await readAPIKeyFromFile();
    if (!existingKey) {
      return this.log('You are not logged in, run `xata auth login` first');
    }

    this.log('Client is logged in');

    await this.verifyAPIKey(existingKey);

    this.log('API key is valid');
  }
}
