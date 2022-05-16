import { Command } from '@oclif/core';

export default class WorkspacesDelete extends Command {
  static description = 'Delete a workspace';

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
