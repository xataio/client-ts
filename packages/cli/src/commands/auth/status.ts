import { BaseCommand } from '../../base.js';
import { hasProfile } from '../../credentials.js';

export default class Status extends BaseCommand<typeof Status> {
  static description = 'Check status of the auth settings';

  static examples = [];

  static flags = {};

  static args = {};

  async run(): Promise<void> {
    const profile = await this.getProfile({ ignoreEnv: true });
    const loggedIn = await hasProfile(profile.name);
    if (!loggedIn) {
      return this.log('You are not logged in, run `xata auth login` first');
    }

    this.info('Client is logged in');

    await this.verifyAPIKey(profile);

    this.success('API key is valid');
  }
}
