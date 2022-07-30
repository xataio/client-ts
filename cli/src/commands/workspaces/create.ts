import { BaseCommand } from '../../base.js';
import { slugify } from '../../utils.js';

export default class WorkspacesCreate extends BaseCommand {
  static description = 'Create a workspace';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = [{ name: 'workspace', description: 'The new workspace name', required: true }];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args } = await this.parse(WorkspacesCreate);
    const { workspace } = args;

    if (!workspace) {
      return this.error('Please, specify a workspace name');
    }

    const xata = await this.getXataClient();

    const result = await xata.workspaces.createWorkspace({ name: workspace, slug: slugify(workspace) });

    if (this.jsonEnabled()) return result;

    this.log(`Workspace ${result.id} successfully created`);
  }
}
