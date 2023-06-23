import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class WorkspaceCreate extends BaseCommand<typeof WorkspaceCreate> {
  static description = 'Create a workspace';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = {
    workspace: Args.string({ description: 'The new workspace name', required: true })
  };

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args } = await this.parseCommand();
    const { workspace } = args;

    if (!workspace) {
      return this.error('Please, specify a workspace name');
    }

    const xata = await this.getXataClient();

    const result = await xata.api.workspaces.createWorkspace({ data: { name: workspace } });

    if (this.jsonEnabled()) return result;

    this.success(`Workspace ${result.id} successfully created`);
  }
}
