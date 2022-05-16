import { Command } from '@oclif/core';

export default class BranchesDelete extends Command {
  static description = 'Delete a branch';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
