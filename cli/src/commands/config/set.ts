import { Args } from '@oclif/core';
import chalk from 'chalk';
import { BaseCommand, projectConfigSchema } from '../../base.js';
import { setValue } from '../../config.js';

export default class SetConfig extends BaseCommand {
  static description = 'Get a specific key from the project configuration given a key path';

  static examples = [];

  static flags = {};

  static args = {
    key: Args.string({ description: 'Key path to get the value from', required: true }),
    value: Args.string({ description: 'Value to store', required: true })
  };

  async run(): Promise<void> {
    const { args } = await this.parse(SetConfig);

    if (!this.projectConfig)
      return this.error(`No project configuration found. Use ${chalk.bold('xata init')} to configure your project.`);

    setValue(args.key, projectConfigSchema, this.projectConfig, args.value);

    await this.updateConfig();
  }
}
