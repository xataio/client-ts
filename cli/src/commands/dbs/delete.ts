import { BaseCommand } from '../../base.js';
import prompts from 'prompts';
import { Flags } from '@oclif/core';
import { parseDatabaseURL } from '../../defaults.js';

export default class DatabasesDelete extends BaseCommand {
  static description = 'Delete a database';

  static examples = [];

  static flags = {
    workspace: Flags.string({
      description: 'Workspace id the database to delete belongs to'
    }),
    database: Flags.string({
      description: 'Database name to delete'
    })
  };

  static args = [];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { flags } = await this.parse(DatabasesDelete);
    const defaults = parseDatabaseURL();
    const workspace = flags.workspace || defaults.workspace;
    const database = flags.database || defaults.database;

    if (!workspace)
      return this.error('Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.');
    if (!database)
      return this.error('Could not find database name. Please set XATA_DATABASE_URL or use the --database flag.');

    const xata = await this.getXataClient();

    const result = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete database ${workspace}/${database}?`,
      initial: true
    });
    if (!result.confirm) return this.exit(1);

    await xata.databases.deleteDatabase(workspace, database);

    if (this.jsonEnabled()) return {};

    this.log(`Database ${workspace}/${database} successfully deleted`);
  }
}
