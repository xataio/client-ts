import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class DatabasesRename extends BaseCommand<typeof DatabasesRename> {
  static description = 'Rename a database';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...BaseCommand.forceFlag(),
    workspace: Flags.string({
      description: 'Workspace id the database to delete belongs to'
    })
  };

  static args = {
    database: Args.string({ description: 'The existing database to rename', required: false }),
    newName: Args.string({ description: 'The new database name', required: false })
  };

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parseCommand();
    const workspaceId = flags.workspace || (await this.getWorkspace());
    const dbName = args.database || (await this.getDatabase(workspaceId, { allowCreate: false })).name;
    const newName =
      args.newName ||
      (await this.prompt({ type: 'text', name: 'newName', message: 'Enter the new database name' })).newName;

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'text',
        name: 'confirm',
        message: `Renaming the database from ${dbName} to ${newName} will also change your endpoint URL. This will require code changes in your application.\nPlease type: ${dbName} to confirm:\n`,
        initial: false
      },
      flags.force ? dbName : undefined
    );
    if (!confirm) return this.exit(1);
    if (confirm !== dbName) return this.error('The database name did not match');

    await xata.api.databases.renameDatabase({ workspaceId, dbName, newName });

    if (this.jsonEnabled()) return {};

    this.success(`Database ${workspaceId}/${dbName} successfully renamed to ${workspaceId}/${newName}`);
  }
}
