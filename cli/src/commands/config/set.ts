import { Args } from '@oclif/core';
import chalk from 'chalk';
import { BaseCommand } from '../../base.js';
import { projectConfigSchema, setValue } from '../../config.js';

export default class SetConfig extends BaseCommand<typeof SetConfig> {
  static description = 'Get a specific key from the project configuration given a key path';

  static examples = [];

  static flags = {};

  static args = {
    key: Args.string({ description: 'Key path to get the value from', required: true }),
    value: Args.string({ description: 'Value to store', required: true })
  };

  async run(): Promise<void> {
    const { args } = await this.parseCommand();

    if (!this.projectConfig)
      return this.error(`No project configuration found. Use ${chalk.bold('xata init')} to configure your project.`);

    setValue(args.key, projectConfigSchema, this.projectConfig, args.value);

    await this.updateConfig();
  }
}
