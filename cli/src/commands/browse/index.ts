import { Command } from '@oclif/core';

export default class Browse extends Command {
  static description = 'Open the current database in the browser';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Browse);

    this.error('To be done');
  }
}
