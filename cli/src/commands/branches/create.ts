import { Command } from '@oclif/core';

export default class BranchesCreate extends Command {
  static description = 'Create a branch';

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
