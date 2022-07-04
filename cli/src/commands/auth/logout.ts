import { BaseCommand } from '../../base.js';
import { getProfile, removeProfile } from '../../credentials.js';

export default class Logout extends BaseCommand {
  static description = 'Logout from Xata';

  static examples = [];

  static flags = {
    ...BaseCommand.forceFlag()
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Logout);
    const existingProfile = await getProfile(true);
    if (!existingProfile) {
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

    await removeProfile();

    this.log('Logged out correctly');
  }
}
