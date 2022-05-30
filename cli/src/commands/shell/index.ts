import { run } from '@xata.io/shell';
import { BaseCommand } from '../../base.js';

export default class Shell extends BaseCommand {
  static description = 'Open a shell to the current database and branch';

  async run(): Promise<void> {
    const databaseURL = await this.getDatabaseURL();
    await run({ databaseURL });
  }
}
