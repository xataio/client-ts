import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { parseDatabaseURL } from '../../defaults.js';

export default class DatabasesCreate extends BaseCommand {
  static description = 'Create a database';

  static examples = [];

  static flags = {
    workspace: Flags.string({
      description: 'Workspace id the database will belongs to'
    })
  };

  static args = [{ name: 'database', description: 'The new database name', required: true }];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parse(DatabasesCreate);
    const { database } = args;

    if (!database) {
      return this.error('Please, specify a database name');
    }

    const defaults = parseDatabaseURL();
    const workspace = flags.workspace || defaults.workspace;

    const xata = await this.getXataClient();

    const result = await xata.databases.createDatabase(workspace, database);

    if (this.jsonEnabled()) return result;

    this.log(`Database ${result.databaseName} successfully created`);
  }
}
