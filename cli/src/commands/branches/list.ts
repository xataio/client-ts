import { Command } from '@oclif/core';

export default class BranchesList extends Command {
  static description = 'List branches';

  static examples = [
    `$ oex hello world
hello world! (./src/commands/hello/world.ts)
`
  ];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.log('hello world! (./src/commands/hello/world.ts)');
  }
}
