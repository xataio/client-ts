import { BaseCommand } from '../../base.js';

export default class WorkspacesCreate extends BaseCommand {
  static description = 'Create a workspace';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
