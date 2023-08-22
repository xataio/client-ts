import { refreshAccessToken } from '../../auth-server.js';
import { BaseCommand } from '../../base.js';
import { readCredentialsDictionary, saveCredentials } from '../../credentials.js';

export default class Refresh extends BaseCommand<typeof Refresh> {
  static description = 'Refresh authentication with Xata';

  static examples = [];

  static flags = {
    ...BaseCommand.forceFlag('Force refresh of the auth token')
  };

  static args = {};

  // This is an support and debugging command, so we hide it from the help menu
  static hidden = true;

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    const profile = await this.getProfile({ ignoreEnv: true });
    const credentials = await readCredentialsDictionary();
    const credential = credentials[profile.name];

    if (!credential?.accessToken || !credential?.refreshToken || !credential?.expiresAt) {
      this.error('Invalid credentials, please login again');
    }

    if (flags.force) {
      const refresh = await refreshAccessToken(credential.web ?? 'https://app.xata.io', credential.refreshToken);
      await saveCredentials(profile.name, {
        ...credential,
        accessToken: refresh.accessToken,
        refreshToken: refresh.refreshToken,
        expiresAt: refresh.expires
      });

      this.success('Successfully refreshed your session');
      return;
    }

    this.info(`Your current session expires at ${new Date(credential.expiresAt).toLocaleString()}, no need to refresh`);
  }
}
