import { BaseCommand } from '../../base.js';

export default class Status extends BaseCommand {
  static description = 'Check status of the auth settings';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    const existingProfile = await this.getProfile(true);
    if (!existingProfile) {
      return this.log('You are not logged in, run `xata auth login` first');
    }

    this.info('Client is logged in');

    await this.verifyAPIKey(existingProfile.apiKey);

    this.success('API key is valid');
  }
}
