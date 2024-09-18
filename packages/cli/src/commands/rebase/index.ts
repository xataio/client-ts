import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import {
  commitToMigrationFile,
  getLastCommonIndex,
  getLocalMigrationFiles,
  removeLocalMigrations,
  writeLocalMigrationFiles
} from '../../migrations/files.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';
import { Schemas } from '@xata.io/client';

export default class Rebase extends BaseCommand<typeof Rebase> {
  static description = 'Reapply local migrations on top of a remote branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to take migrations from', required: true })
  };

  static hidden = true;

  async run() {
    const { args, flags } = await this.parse(Rebase);

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch,
      true
    );

    this.info(`Rebase command is experimental, use with caution`);
    const details = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });

    if (isBranchPgRollEnabled(details)) {
      let logs: (Schemas.MigrationHistoryItem | Schemas.Commit)[] = [];
      let cursor = undefined;
      do {
        const { migrations, cursor: newCursor } = await xata.api.migrations.getMigrationHistory({
          pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
          queryParams: { cursor, limit: 200 }
        });

        logs = logs.concat(migrations);
        cursor = newCursor;
      } while (cursor !== undefined);

      const remoteMigrationFiles = commitToMigrationFile(logs);
      const localMigrationFiles = await getLocalMigrationFiles(isBranchPgRollEnabled(details));

      const lastCommonMigrationIndex = getLastCommonIndex(localMigrationFiles, remoteMigrationFiles);

      const migrationsToRebase = localMigrationFiles.slice(lastCommonMigrationIndex);

      const newMigrationFiles = [...remoteMigrationFiles, ...migrationsToRebase];

      await removeLocalMigrations();
      await writeLocalMigrationFiles(newMigrationFiles);
    } else {
      const { logs } = await xata.api.migrations.getBranchSchemaHistory({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: {
          // TODO: Fix pagination in the API to start from last known migration and not from the beginning
          // Also paginate until we get all migrations
          page: { size: 200 }
        }
      });

      const remoteMigrationFiles = commitToMigrationFile(logs);
      const localMigrationFiles = await getLocalMigrationFiles();

      const lastCommonMigrationIndex = getLastCommonIndex(localMigrationFiles, remoteMigrationFiles);

      const migrationsToRebase = localMigrationFiles.slice(lastCommonMigrationIndex);

      const newMigrationFiles = [...remoteMigrationFiles, ...migrationsToRebase];

      // TODO: Check if there are any conflicts

      await removeLocalMigrations();
      await writeLocalMigrationFiles(newMigrationFiles);
    }
  }
}
