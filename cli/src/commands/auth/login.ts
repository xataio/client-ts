import { Flags } from '@oclif/core';
import { parseProviderString } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import { Credential, hasProfile, saveCredentials } from '../../credentials.js';

export default class Login extends BaseCommand<typeof Login> {
  static description = 'Authenticate with Xata';

  static examples = [];

  static flags = {
    ...BaseCommand.forceFlag('Overwrite existing credentials if they exist'),
    host: Flags.string({
      description: 'Xata API host provider'
    }),
    web: Flags.string({
      description: 'Xata web host provider'
    })
  };

  static args = {};

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    const profile = await this.getProfile({ ignoreEnv: true });
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

    const { accessToken, refreshToken, expires } = await this.obtainKey(flags.web);
    const credential: Credential = {
      ...profile,
      accessToken,
      refreshToken,
      expiresAt: expires,
      web: flags.web || profile.web,
      api: flags.host
    };

    await saveCredentials(profile.name, credential);

    const newProfile = await this.getProfile({ profileName: profile.name });
    await this.verifyProfile(newProfile);

    this.success('All set! you can now start using xata');
  }
}
