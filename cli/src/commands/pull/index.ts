import { Flags } from '@oclif/core';
import { parseTablesFromCodegen } from '@xata.io/codegen';
import { readFile } from 'fs/promises';
import { BaseCommand } from '../../base.js';

export default class Pull extends BaseCommand {
  static description = 'Push local migrations to a remote Xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = [
    {
      name: 'branch',
      description: 'The remote branch to push to',
      required: false
    }
  ];

  async run() {
    const { args, flags } = await this.parse(Pull);

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch ?? 'main',
      true
    );

    const { logs, meta } = await xata.api.migrations.getBranchSchemaHistory({
      workspace,
      region,
      database,
      branch,
      page: { before: 'end', size: 200 }
    });

    this.log(`Found ${logs.length} migrations in ${branch}`);
    this.log(`Meta: ${JSON.stringify(meta, null, 2)}`);
  }
}
