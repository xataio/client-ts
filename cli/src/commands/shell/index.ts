import { Base } from '../../base.js';

export default class Shell extends Base {
  static description = 'Open a shell to the current database';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    // const { args, flags } = await this.parse(Shell);

    this.error('To be done');
  }
}
