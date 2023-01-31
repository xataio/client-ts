import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class DatabasesDelete extends BaseCommand {
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
    database: Args.string({ description: 'The database name to delete', required: true })
  };

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags, args } = await this.parse(DatabasesDelete);
    const workspace = flags.workspace || (await this.getWorkspace());
    const database = args.database;

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt(
      {
        type: 'text',
        name: 'confirm',
        message: `Are you sure you want to delete database ${database} in the ${workspace} workspace? Please type ${database} to confirm`,
        initial: false
      },
      flags.force ? database : undefined
    );
    if (!confirm) return this.exit(1);
    if (confirm !== database) return this.error('The database name did not match');

    await xata.database.deleteDatabase({ workspace, database });

    if (this.jsonEnabled()) return {};

    this.success(`Database ${workspace}/${database} successfully deleted`);
  }
}
