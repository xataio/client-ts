import { Flags } from '@oclif/core';
import { parseProviderString } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import { hasProfile, setProfile } from '../../credentials.js';

export default class Login extends BaseCommand<typeof Login> {
  static description = 'Authenticate with Xata';

  static examples = [];

  static flags = {
    ...BaseCommand.forceFlag('Overwrite existing credentials if they exist'),
    host: Flags.string({
      description: 'Xata API host provider'
    })
  };

  static args = {};

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    const profile = await this.getProfile(true);
    const loggedIn = await hasProfile(profile.name);
    if (loggedIn) {
      const { overwrite } = await this.prompt(
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Authentication is already configured for the ${profile.name} profile, do you want to overwrite it?`
        },
        flags.force
      );
      if (!overwrite) this.exit(2);
    }

    const host = parseProviderString(flags.host);
    if (!host) {
      this.error('Invalid host provider, expected either "production", "staging" or "{apiUrl},{workspacesUrl}"');
    }

    const key = await this.obtainKey();

    await this.verifyAPIKey({ ...profile, apiKey: key, host });

    await setProfile(profile.name, { apiKey: key, api: flags.host });

    this.success('All set! you can now start using xata');
  }
}
