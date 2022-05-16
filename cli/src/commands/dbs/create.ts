import { Command } from '@oclif/core';

export default class DatabasesCreate extends Command {
  static description = 'Create a database';

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
