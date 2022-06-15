import { BaseCommand } from '../../base.js';

export default class WorkersCompile extends BaseCommand {
  static description = 'Extract and compile xata workers';

  static flags = {};

  async run(): Promise<void> {
    this.log('hello world');
  }
}
