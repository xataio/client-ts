import prompts from 'prompts';
import { BaseCommand } from '../../base.js';
import { readAPIKeyFromFile, writeAPIKey } from '../../key.js';

export default class Login extends BaseCommand {
  static description = 'Authenticate with Xata';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    const existingKey = await readAPIKeyFromFile();
    if (existingKey) {
      const { overwrite } = await prompts({
        type: 'confirm',
        name: 'overwrite',
        message: 'Authentication is already configured, do you want to overwrite it?'
      });
      if (!overwrite) this.exit(2);
    }

    this.log(
      'You can generate a new API key at https://app.xata.io. You can learn more about API keys on our documentation site: https://docs.xata.io/concepts/api-keys'
    );
    const { key } = await prompts({
      type: 'password',
      name: 'key',
      message: 'Introduce your API key:'
    });
    if (!key) this.exit(2);

    await this.verifyAPIKey(key);

    await writeAPIKey(key);

    this.log('All set! you can now start using xata');
  }
}
