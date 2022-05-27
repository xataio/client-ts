import { BaseCommand } from '../../base.js';
import get from 'lodash.get';
import chalk from 'chalk';

export default class Get extends BaseCommand {
  static description = 'Set a specific key from the project configuration given a key path and a value';

  static examples = [];

  static flags = {};

  static args = [{ name: 'key', description: 'Key path to get the value from', required: true }];

  async run(): Promise<void> {
    const { args } = await this.parse(Get);

    if (!this.projectConfig)
      return this.error(`No project configuration found. Use ${chalk.bold('xata init')} to configure your project.`);

    const value = get(this.projectConfig, args.key);

    if (typeof value === 'object') return this.error('Key found but it is an object');

    this.log(String(value));
  }
}
