import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import {
  commitToMigrationFile,
  getLocalMigrationFiles,
  removeLocalMigrations,
  writeLocalMigrationFiles
} from '../../migrations/files.js';

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

    const lastCommonMigrationIndex = remoteMigrationFiles.reduce((index, remoteMigration) => {
      if (remoteMigration.id === localMigrationFiles[index + 1]?.id) {
        return index + 1;
      }

      return index;
    }, -1);

    const migrationsToRebase = localMigrationFiles.slice(lastCommonMigrationIndex);

    const newMigrationFiles = [...remoteMigrationFiles, ...migrationsToRebase];

    // TODO: Check if there are any conflicts

    await removeLocalMigrations();
    await writeLocalMigrationFiles(newMigrationFiles);
  }
}
