import { Command } from '@oclif/core';

export default class Workspaces extends Command {
  static description = 'List, create and delete workspaces';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Workspaces);

    this.error('To be done');
  }
}
