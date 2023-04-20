import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import WorkspaceCreate from '../workspace/create.js';

export default class WorkspacesCreate extends BaseCommand<typeof WorkspaceCreate> {
  static description = 'Create a workspace';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = {
    workspace: Args.string({ description: 'The new workspace name', required: true })
  };

  static enableJsonFlag = true;

  static hidden = true;

  async run(): Promise<void | unknown> {
    this.warn('This command is deprecated. Please use `xata workspace create` instead.');

    const { argv } = await this.parseCommand();
    return await WorkspaceCreate.run([...argv]);
  }
}
