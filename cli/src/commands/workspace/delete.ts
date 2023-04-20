import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class WorkspaceDelete extends BaseCommand<typeof WorkspaceDelete> {
  static description = 'Delete a workspace';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...BaseCommand.forceFlag(),
    workspace: Flags.string({
      description: 'Workspace id to delete'
    })
  };

  static args = {};

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags } = await this.parseCommand();
    const workspace = flags.workspace || (await this.getWorkspace());

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'text',
        name: 'confirm',
        message: `Are you sure you want to delete the ${workspace} workspace? Please type ${workspace} to confirm`
      },
      flags.force ? workspace : undefined
    );
    if (!confirm) return this.exit(1);
    if (confirm !== workspace) return this.error('The workspace name did not match');

    await xata.api.workspaces.deleteWorkspace({ workspace });

    if (this.jsonEnabled()) return {};

    this.success(`Workspace ${workspace} successfully deleted`);
  }
}
