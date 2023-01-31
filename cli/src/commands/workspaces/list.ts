import { BaseCommand } from '../../base.js';
export default class WorkspacesList extends BaseCommand {
  static description = 'List your workspaces';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = {};

  static enableJsonFlag = true;

  async run(): Promise<any> {
    const xata = await this.getXataClient();
    const workspacesList = await xata.workspaces.getWorkspacesList();

    if (this.jsonEnabled()) return workspacesList.workspaces;

    const headers = ['Name', 'Id', 'Role'];
    const rows = workspacesList.workspaces.map((b) => [b.name, b.id, b.role]);
    this.printTable(headers, rows);
  }
}
