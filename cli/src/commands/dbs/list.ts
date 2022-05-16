import { Command } from '@oclif/core';

export default class DatabasesList extends Command {
  static description = 'List your databases';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
