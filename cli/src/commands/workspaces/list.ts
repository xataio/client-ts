import { BaseCommand } from '../../base.js';
import WorkspaceList from '../workspace/list.js';

export default class WorkspacesList extends BaseCommand<typeof WorkspacesList> {
  static description = 'List your workspaces';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = {};

  static enableJsonFlag = true;

  static hidden = true;

  async run(): Promise<any> {
    this.warn('This command is deprecated. Please use `xata workspace list` instead.');

    const { argv } = await this.parseCommand();
    return await WorkspaceList.run([...argv]);
  }
}
