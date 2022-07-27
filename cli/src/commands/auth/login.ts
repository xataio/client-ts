import { BaseCommand } from '../../base.js';
import { setProfile } from '../../credentials.js';

export default class Login extends BaseCommand {
  static description = 'Authenticate with Xata';

  static examples = [];

  static flags = {
    ...BaseCommand.forceFlag('Overwrite existing credentials if they exist')
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);
    const existingProfile = await this.getProfile(true);
    if (existingProfile) {
      const { overwrite } = await this.prompt(
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Authentication is already configured, do you want to overwrite it?'
        },
        flags.force
      );
      if (!overwrite) this.exit(2);
    }

    const key = await this.obtainKey();

    await this.verifyAPIKey(key);

    await setProfile({ apiKey: key });

    this.log('All set! you can now start using xata');
  }
}
