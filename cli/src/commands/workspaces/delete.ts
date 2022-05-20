import { Base } from '../../base.js';

export default class WorkspacesDelete extends Base {
  static description = 'Delete a workspace';

  static examples = [];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.error('To be done');
  }
}
