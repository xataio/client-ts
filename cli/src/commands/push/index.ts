import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import { commitToMigrationFile, getLastCommonIndex, getLocalMigrationFiles } from '../../migrations/files.js';
import { allMigrationsPgRollFormat, isBranchPgRollEnabled, isMigrationPgRollFormat } from '../../migrations/pgroll.js';
import { pgRollMigrationHistoryObject } from '../../migrations/schema.js';

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

    const details = await xata.api.branches.getBranchDetails({
      workspace,
      region,
      database,
      branch
    });

    let logs: Schemas.PgRollMigrationHistoryItem[] | Schemas.Commit[] = [];
    if (isBranchPgRollEnabled(details)) {
      const { migrations } = await xata.api.branches.pgRollMigrationHistory({
        workspace,
        region,
        database,
        branch
      });
      logs = migrations;
    } else {
      const data = await xata.api.migrations.getBranchSchemaHistory({
        workspace,
        region,
        database,
        branch,
        // TODO: Fix pagination in the API to start from last known migration and not from the beginning
        // Also paginate until we get all migrations
        page: { size: 200 }
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
      const migrationsToPush = (newMigrations as Schemas.PgRollMigrationHistoryItem[])
        .map(({ migration }) => migration)
        .flatMap((migration) => pgRollMigrationHistoryObject.parse(JSON.parse(migration)));
      for (const migration of migrationsToPush) {
        try {
          await xata.api.branches.applyMigration({
            workspace,
            region,
            database,
            branch,
            migration
          });
        } catch (e) {
          this.log(`Failed to push ${migration} with ${e}. Stopping.`);
          this.exit(1);
        }
      }
    } else {
      // TODO: Check for errors and print them
      await xata.api.migrations.pushBranchMigrations({
        workspace,
        region,
        database,
        branch,
        migrations: newMigrations as Schemas.MigrationObject[]
      });
    }

    this.log(`Pushed ${newMigrations.length} migrations to ${branch}`);
  }

  getNewMigrations(
    localMigrationFiles: Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[],
    remoteMigrationFiles: Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[]
  ): Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[] {
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
