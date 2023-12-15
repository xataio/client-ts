import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class DatabasesDelete extends BaseCommand<typeof DatabasesDelete> {
  static description = 'Delete a database';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...BaseCommand.forceFlag(),
    workspace: Flags.string({
      description: 'Workspace id the database to delete belongs to'
    })
  };

  static args = {
    database: Args.string({ description: 'The database name to delete', required: false })
  };

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parseCommand();
    const workspaceId = flags.workspace || (await this.getWorkspace());
    const dbName = args.database || (await this.getDatabase(workspaceId, { allowCreate: false })).name;

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'text',
        name: 'confirm',
        message: `Are you sure you want to delete database ${dbName} in the ${workspaceId} workspace?\nPlease type ${dbName} to confirm:\n`,
        initial: false
      },
      flags.force ? dbName : undefined
    );
    if (!confirm) return this.exit(1);
    if (confirm !== dbName) return this.error('The database name did not match');

    await xata.api.databases.deleteDatabase({ workspaceId, dbName });

    if (this.jsonEnabled()) return {};

    this.success(`Database ${workspaceId}/${dbName} successfully deleted`);
  }
}
