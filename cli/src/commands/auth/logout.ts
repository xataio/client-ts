import { BaseCommand } from '../../base.js';
import { hasProfile, removeProfile } from '../../credentials.js';

export default class Logout extends BaseCommand<typeof Logout> {
  static description = 'Logout from Xata';

  static examples = [];

  static flags = {
    ...BaseCommand.forceFlag()
  };

  static args = {};

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    const profile = await this.getProfile({ ignoreEnv: true });
    const loggedIn = await hasProfile(profile.name);
    if (!loggedIn) {
      return this.error('You are not logged in');
    }

    const { confirm } = await this.prompt(
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to logout of Xata?',
        initial: true
      },
      flags.force
    );
    if (!confirm) this.exit(2);

    await removeProfile(profile.name);

    this.success('Logged out correctly');
  }
}
