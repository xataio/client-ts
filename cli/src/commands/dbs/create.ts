import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';

export default class DatabasesCreate extends BaseCommand<typeof DatabasesCreate> {
  static description = 'Create a database';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    workspace: Flags.string({
      description: 'Workspace id the database will belongs to'
    }),
    region: Flags.string({
      description: 'Region where the database will be created'
    })
  };

  static args = {
    database: Args.string({ description: 'The new database name', required: false })
  };

  static enableJsonFlag = true;

  async run(): Promise<void | unknown> {
    const { args, flags } = await this.parseCommand();

    const workspace = flags.workspace || (await this.getWorkspace());

    const result = await this.createDatabase(workspace, { overrideName: args.database, overrideRegion: flags.region });

    if (this.jsonEnabled()) return result;

    this.success(`Database ${result.name} successfully created`);
  }
}
