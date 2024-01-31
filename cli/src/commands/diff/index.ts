import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { getLocalMigrationFiles } from '../../migrations/files.js';
import { buildMigrationDiff } from '../../utils/diff.js';
import { Schemas } from '@xata.io/client';

export default class Diff extends BaseCommand<typeof Diff> {
  static description = 'Compare two local or remote branches';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to compare', required: false }),
    base: Args.string({ description: 'The base branch to compare against', required: false })
  };

  static hidden = true;

  static enableJsonFlag = true;

  async run() {
    const { args, flags } = await this.parseCommand();

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch ?? 'main'
    );

    this.info(`Diff command is experimental, use with caution`);

    const localMigrationFiles = await getLocalMigrationFiles();
    // TODO remove assertion after complete pgroll migration
    const schemaOperations = localMigrationFiles.flatMap(
      (migrationFile) => (migrationFile as Schemas.MigrationObject).operations
    );

    const apiRequest =
      args.branch && args.base
        ? xata.api.migrations.compareBranchSchemas({
            workspace,
            region,
            database,
            branch: args.branch,
            compare: args.base
          })
        : xata.api.migrations.compareBranchWithUserSchema({
            workspace,
            region,
            database,
            branch,
            schema: { tables: [] },
            schemaOperations
          });

    const {
      edits: { operations }
    } = await apiRequest;

    const diff = buildMigrationDiff(operations);
    if (this.jsonEnabled()) return diff;

    if (operations.length === 0) {
      this.log('No changes found');
      return;
    }

    this.log(diff);
  }
}
