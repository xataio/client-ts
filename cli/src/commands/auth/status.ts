import { BaseCommand } from '../../base.js';
import { getProfile } from '../../credentials.js';

export default class Status extends BaseCommand {
  static description = 'Check status of the auth settings';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    const existingProfile = await getProfile(true);
    if (!existingProfile) {
      return this.log('You are not logged in, run `xata auth login` first');
    }

    this.log('Client is logged in');

    await this.verifyAPIKey(existingProfile.apiKey);

    this.log('API key is valid');
  }
}
