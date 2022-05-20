import { Command } from '@oclif/core';

export default class DatabasesDelete extends Command {
  static description = 'Delete a database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
