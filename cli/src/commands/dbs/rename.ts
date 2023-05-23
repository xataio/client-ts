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
    const workspace = flags.workspace || (await this.getWorkspace());
    const database = args.database || (await this.getDatabase(workspace, { allowCreate: false })).name;
    const newName =
      args.newName ||
      (await this.prompt({ type: 'text', name: 'newName', message: 'Enter the new database name' })).newName;

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'text',
        name: 'confirm',
        message: `Renaming the database from ${database} to ${newName} will also change your endpoint URL. This will require code changes in your application.\nPlease type: ${database} to confirm:\n`,
        initial: false
      },
      flags.force ? database : undefined
    );
    if (!confirm) return this.exit(1);
    if (confirm !== database) return this.error('The database name did not match');

    await xata.api.database.renameDatabase({ workspace, database, newName });

    if (this.jsonEnabled()) return {};

    this.success(`Database ${workspace}/${database} successfully renamed to ${workspace}/${newName}`);
  }
}
