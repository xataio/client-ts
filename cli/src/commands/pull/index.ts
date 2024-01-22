import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import {
  commitToMigrationFile,
  getLocalMigrationFiles,
  removeLocalMigrations,
  writeLocalMigrationFiles
} from '../../migrations/files.js';
import Codegen from '../codegen/index.js';
import { isPgRollEnabled, isPgRollMigration, migrationsNotPgRollFormat } from '../../migrations/pgroll.js';

export default class Pull extends BaseCommand<typeof Pull> {
  static description = 'Pull changes from remote Xata branch and regenerate code';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite local migrations',
      default: false
    }),
    'skip-code-generation': Flags.boolean({
      description: 'Skip code generation',
      default: false
    })
  };

  static args = {
    branch: Args.string({ description: 'The remote branch to pull from', required: true })
  };

  async run() {
    const { args, flags } = await this.parseCommand();
    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch,
      true
    );

    const details = await xata.api.branch.getBranchDetails({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` }
    });

    let logs: Schemas.PgRollMigrationHistoryItem[] | Schemas.Commit[] = [];
    if (isPgRollEnabled(details)) {
      const { migrations } = await xata.api.branch.pgRollMigrationHistory({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` }
      });
      logs = migrations;
    } else {
      const data = await xata.api.migrations.getBranchSchemaHistory({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: {
          // TODO: Fix pagination in the API to start from last known migration and not from the beginning
          // Also paginate until we get all migrations
          page: { size: 200 }
        }
      });
      logs = data.logs;
    }

    if (flags.force) {
      await removeLocalMigrations();
    }

    let localMigrationFiles: Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[] = [];
    try {
      localMigrationFiles = await getLocalMigrationFiles(isPgRollEnabled(details));
    } catch (e) {
      if (e instanceof TypeError && isPgRollEnabled(details) && migrationsNotPgRollFormat(localMigrationFiles)) {
        await removeLocalMigrations();
        localMigrationFiles = await getLocalMigrationFiles(isPgRollEnabled(details));
        this.log(`Converting existing migrations to pgroll format from ${branch} branch`);
      }
    }

    const newMigrations = this.getNewMigrations(localMigrationFiles, commitToMigrationFile(logs));
    await writeLocalMigrationFiles(newMigrations);

    if (newMigrations.length === 0) {
      this.log(`No new migrations to pull from ${branch} branch`);
      return;
    }

    this.log(`Successfully pulled ${newMigrations.length} migrations from ${branch} branch`);

    if (this.projectConfig?.codegen && !flags['skip-code-generation']) {
      this.log(`Running codegen...`);
      await Codegen.run(['--branch', branch]);
    }
  }

  getNewMigrations(
    localMigrationFiles: Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[],
    remoteMigrationFiles: Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[]
  ): Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[] {
    const lastCommonMigrationIndex = remoteMigrationFiles.reduce((index, remoteMigration) => {
      const remoteIdentifier = isPgRollMigration(remoteMigration) ? remoteMigration.name : remoteMigration.id;
      const localItem = localMigrationFiles[index + 1];
      if (!localItem) {
        return index;
      }
      const localIdentifier = localItem && isPgRollMigration(localItem) ? localItem.name : localItem.id;
      if (remoteIdentifier === localIdentifier) {
        return index + 1;
      }

      return index;
    }, -1);

    // TODO: Validate that the migrations are in the same order (for previous history)

    const newLocalMigrations = localMigrationFiles.slice(lastCommonMigrationIndex + 1);
    const newRemoteMigrations = remoteMigrationFiles.slice(lastCommonMigrationIndex + 1);

    if (newLocalMigrations.length > 0 && newRemoteMigrations.length > 0) {
      this.log(
        'There are new migrations both locally and in the remote branch. Please run `xata pull -f` to overwrite local migrations.'
      );
      this.exit(0);
    }

    return newRemoteMigrations;
  }
}
