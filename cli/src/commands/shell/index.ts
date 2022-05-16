import { Command } from '@oclif/core';

export default class Shell extends Command {
  static description = 'Open a shell to the current database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Shell);

    this.error('To be done');
  }
}
