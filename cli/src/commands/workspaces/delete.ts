import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class WorkspacesDelete extends BaseCommand {
  static description = 'Delete a workspace';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...BaseCommand.forceFlag(),
    workspace: Flags.string({
      description: 'Workspace id to delete'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags } = await this.parse(WorkspacesDelete);
    const workspace = flags.workspace || (await this.getWorkspace());

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete workspace ${workspace}?`,
        initial: false
      },
      flags.force
    );
    if (!confirm) return this.exit(1);

    await xata.workspaces.deleteWorkspace(workspace);

    if (this.jsonEnabled()) return {};

    this.log(`Workspace ${workspace} successfully deleted`);
  }
}
