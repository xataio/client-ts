import { Flags } from '@oclif/core';
import prompts from 'prompts';
import { BaseCommand } from '../../base.js';

export default class DatabasesDelete extends BaseCommand {
  static description = 'Delete a database';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    workspace: Flags.string({
      description: 'Workspace id the database to delete belongs to'
    })
  };

  static args = [{ name: 'database', description: 'The database name to delete', required: true }];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags, args } = await this.parse(DatabasesDelete);
    const workspace = flags.workspace || (await this.getWorkspace());
    const database = args.database;

    const xata = await this.getXataClient();

    const { confirm } = await this.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete database ${workspace}/${database}?`,
      initial: true
    });
    if (!confirm) return this.exit(1);

    await xata.databases.deleteDatabase(workspace, database);

    if (this.jsonEnabled()) return {};

    this.log(`Database ${workspace}/${database} successfully deleted`);
  }
}
