import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import WorkspaceDelete from '../workspace/delete.js';

export default class WorkspacesDelete extends BaseCommand<typeof WorkspacesDelete> {
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

  static hidden = true;

  async run(): Promise<void | unknown> {
    this.warn('This command is deprecated. Please use `xata workspace delete` instead.');

    const { argv } = await this.parseCommand();
    return await WorkspaceDelete.run([...argv]);
  }
}
