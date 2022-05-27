import { Flags } from '@oclif/core';
import prompts from 'prompts';
import { BaseCommand } from '../../base.js';

export default class WorkspacesDelete extends BaseCommand {
  static description = 'Delete a workspace';

  static examples = [];

  static flags = {
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

    const result = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete workspace ${workspace}?`,
      initial: true
    });
    if (!result.confirm) return this.exit(1);

    await xata.workspaces.deleteWorkspace(workspace);

    if (this.jsonEnabled()) return {};

    this.log(`Workspace ${workspace} successfully deleted`);
  }
}
