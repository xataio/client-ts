import { Command } from '@oclif/core';

export default class WorkspacesDelete extends Command {
  static description = 'Delete a workspace';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
