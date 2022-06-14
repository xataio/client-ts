import prompts from 'prompts';
import { createAPIKeyThroughWebUI } from '../../auth-server.js';
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

    const { decision } = await prompts({
      type: 'select',
      name: 'decision',
      message: 'Do you want to use an existing API key or create a new API key?',
      choices: [
        { title: 'Create a new API key opening a browser', value: 'create' },
        { title: 'Existing API key', value: 'existing' }
      ]
    });
    if (!decision) this.exit(2);

    const key = await this.obtainKey(decision);

    await this.verifyAPIKey(key);

    await writeAPIKey(key);

    this.log('All set! you can now start using xata');
  }

  async obtainKey(decision: 'create' | 'existing') {
    if (decision === 'create') {
      return createAPIKeyThroughWebUI();
    } else if (decision === 'existing') {
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'Introduce your API key:'
      });
      if (!key) this.exit(2);
      return key;
    }
  }
}
