import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class DatabasesCreate extends BaseCommand {
  static description = 'Create a database';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    workspace: Flags.string({
      description: 'Workspace id the database will belongs to'
    })
  };

  static args = [
    { name: 'database', description: 'The new database name', required: false },
    { name: 'region', description: 'The region where the database will be created', required: false }
  ];

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parse(DatabasesCreate);
    const { database, region } = args;

    const workspace = flags.workspace || (await this.getWorkspace());

    const result = await this.createDatabase(workspace, { overrideName: database, overrideRegion: region });

    if (this.jsonEnabled()) return result;

    this.success(`Database ${result.databaseName} successfully created`);
  }
}
