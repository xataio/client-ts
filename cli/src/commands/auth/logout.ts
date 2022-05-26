import prompts from 'prompts';
import { BaseCommand } from '../../base.js';
import { readAPIKeyFromFile, removeAPIKey } from '../../key.js';

export default class Logout extends BaseCommand {
  static description = 'Logout from Xata';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    const existingKey = await readAPIKeyFromFile();
    if (!existingKey) {
      return this.error('You are not logged in');
    }
    const result = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to logout of Xata?'
    });
    if (!result.confirm) this.exit(2);

    await removeAPIKey();

    this.log('Logged out correctly');
  }
}
