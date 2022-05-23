import { Command } from '@oclif/core';
import { run } from '@xata.io/shell';

export default class Shell extends Command {
  static description = 'Open a shell to the current database and branch';

  async run(): Promise<void> {
    await run({});
  }
}
