import { Command } from '@oclif/core';

export default class WorkspacesList extends Command {
  static description = 'List your workspaces';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
