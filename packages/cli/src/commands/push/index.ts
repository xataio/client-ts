import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { PgRollMigrationDefinition } from '@xata.io/pgroll';
import { BaseCommand } from '../../base.js';
import {
  LocalMigrationFile,
  commitToMigrationFile,
  getLastCommonIndex,
  getLocalMigrationFiles
} from '../../migrations/files.js';
import {
  allMigrationsPgRollFormat,
  getBranchDetailsWithPgRoll,
  isBranchPgRollEnabled,
  isMigrationPgRollFormat,
  waitForMigrationToFinish
} from '../../migrations/pgroll.js';
import { MigrationFilePgroll } from '../../migrations/schema.js';

export default class Push extends BaseCommand<typeof Push> {
  static description = 'Push local changes to a remote Xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    ...this.yesFlag,
    'dry-run': Flags.boolean({
      description: "Show what would be pushed, but don't actually push",
      default: false
    })
  };

  static args = {
    branch: Args.string({ description: 'The remote branch to push to', required: true })
  };

  async run() {
    const { args, flags } = await this.parseCommand();

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch,
      true
    );

    const details = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });

    let logs: (Schemas.MigrationHistoryItem | Schemas.Commit)[] = [];
    let cursor = undefined;
    if (isBranchPgRollEnabled(details)) {
      do {
        const { migrations, cursor: newCursor } = await xata.api.migrations.getMigrationHistory({
          pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
          queryParams: { cursor, limit: 200 }
        });

        logs = logs.concat(migrations);
        cursor = newCursor;
      } while (cursor !== undefined);
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

    if (isBranchPgRollEnabled(details) && !(await allMigrationsPgRollFormat())) {
      this.log(`Please run xata pull -f to convert all migrations to pgroll format`);
      return;
    }

    const localMigrationFiles = await getLocalMigrationFiles(isBranchPgRollEnabled(details));

    const newMigrations = this.getNewMigrations(localMigrationFiles, commitToMigrationFile(logs));

    if (newMigrations.length === 0) {
      this.log('No new migrations to push');
      return;
    }

    newMigrations.forEach((migration) => {
      isMigrationPgRollFormat(migration) ? this.log(`  ${migration.name}`) : this.log(`  ${migration.id}`);
    });

    if (flags['dry-run']) {
      this.log(`A total of ${newMigrations.length} migrations would be pushed to ${branch}.`);
      return;
    }

    const { confirm } = await this.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `Do you want to push ${newMigrations.length} migrations to ${branch}?`,
      initial: true
    });

    if (!confirm) return this.exit(1);

    if (isBranchPgRollEnabled(details)) {
      const migrationsToPush = (newMigrations as MigrationFilePgroll[]).map(({ migration, schema }) => ({
        operations: PgRollMigrationDefinition.parse(migration),
        schema
      }));
      for (const migration of migrationsToPush) {
        try {
          const { jobID } = await xata.api.migrations.applyMigration({
            pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
            body: { ...migration.operations, schema: migration.schema }
          });

          await waitForMigrationToFinish(xata.api, workspace, region, database, branch, jobID);
        } catch (e) {
          this.log(`Failed to push ${migration} with ${e}. Stopping.`);
          this.exit(1);
        }
      }
    } else {
      // TODO: Check for errors and print them
      await xata.api.migrations.pushBranchMigrations({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: { migrations: newMigrations as Schemas.MigrationObject[] }
      });
    }

    this.log(`Pushed ${newMigrations.length} migrations to ${branch}`);
  }

  getNewMigrations(
    localMigrationFiles: LocalMigrationFile[],
    remoteMigrationFiles: LocalMigrationFile[]
  ): LocalMigrationFile[] {
    if (localMigrationFiles.length === 0 && remoteMigrationFiles.length > 0) {
      this.log('There are new migrations on the remote branch. Please run `xata pull` to get the latest migrations.');
      this.exit(0);
    }

    const lastCommonMigrationIndex = getLastCommonIndex(localMigrationFiles, remoteMigrationFiles);

    const newLocalMigrations = localMigrationFiles.slice(lastCommonMigrationIndex + 1);
    const newRemoteMigrations = remoteMigrationFiles.slice(lastCommonMigrationIndex + 1);

    if (newLocalMigrations.length === 0 && newRemoteMigrations.length > 0) {
      this.log('There are new migrations on the remote branch. Please run `xata pull` to get the latest migrations.');
      this.exit(0);
    }

    if (newLocalMigrations.length > 0 && newRemoteMigrations.length > 0) {
      this.log(
        'There are new migrations both locally and in the remote branch. Please run `xata pull -f` to overwrite local migrations.'
      );
      this.exit(0);
    }

    return newLocalMigrations;
  }
}
