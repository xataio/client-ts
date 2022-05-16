import { Command } from '@oclif/core';

export default class Schema extends Command {
  static description = 'View and edit the schema of the current database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Schema);

    this.error('To be done');
  }
}
