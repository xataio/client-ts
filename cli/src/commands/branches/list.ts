import { Command } from '@oclif/core';

export default class BranchesList extends Command {
  static description = 'List branches';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
