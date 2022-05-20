import { Base } from '../../base.js';
import { getXataClient } from '../../client.js';
export default class WorkspacesList extends Base {
  static description = 'List your workspaces';

  static examples = [];

  static flags = {};

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<any> {
    const xata = await getXataClient(this);
    const workspacesList = await xata.workspaces.getWorkspacesList();

    if (this.jsonEnabled()) return workspacesList.workspaces;

    const headers = ['Name', 'Id', 'Role'];
    const rows = workspacesList.workspaces.map((b) => [b.name, b.id, b.role]);
    this.printTable(headers, rows);
  }
}
