import { Flags } from '@oclif/core';
import { parseTablesFromCodegen } from '@xata.io/codegen';
import { readFile } from 'fs/promises';
import { BaseCommand } from '../../base.js';

export default class Push extends BaseCommand {
  static description = 'Push local migrations to a remote Xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    'dry-run': Flags.boolean({
      description: "Don't actually push, just show what would be pushed",
      default: false
    })
  };

  static args = [
    {
      name: 'branch',
      description: 'The remote branch to push to',
      required: false
    }
  ];

  async run() {
    const { args, flags } = await this.parse(Push);
    const { dryRun } = flags;

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch ?? 'main',
      true
    );

    const output = this.projectConfig?.codegen?.output ?? '';
    const codegen = await readFile(output, 'utf8').catch(() => undefined);
    if (!codegen) {
      return this.error('Unable to read output file in project configuration');
    }

    const tables = parseTablesFromCodegen(codegen);
    if (!tables) {
      return this.error('Unable to parse tables from codegen output');
    }

    const { edits, source, target } = await xata.api.migrations.compareBranchWithUserSchema({
      workspace,
      region,
      database,
      branch,
      schema: { tables }
    });

    this.log(`Would have pushed ${edits.operations.length} migrations to ${branch}`);
    this.log(`Edits: ${JSON.stringify(edits, null, 2)}`);
    this.log(`Source: ${JSON.stringify(source, null, 2)}`);
    this.log(`Target: ${JSON.stringify(target, null, 2)}`);
  }
}
