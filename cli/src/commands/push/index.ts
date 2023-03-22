import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import { commitToMigrationFile, getLocalMigrationFiles } from '../../migrations/files.js';

export default class Push extends BaseCommand<typeof Push> {
  static description = 'Push local migrations to a remote Xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    'dry-run': Flags.boolean({
      description: "Show what would be pushed, but don't actually push",
      default: false
    })
  };

  static args = {
    branch: Args.string({ description: 'The remote branch to push to', required: true })
  };

  static hidden = true;

  async run() {
    const { args, flags } = await this.parseCommand();

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch,
      true
    );

    const { logs } = await xata.api.migrations.getBranchSchemaHistory({
      workspace,
      region,
      database,
      branch,
      // TODO: Fix pagination in the API to start from last known migration and not from the beginning
      // Also paginate until we get all migrations
      page: { size: 200 }
    });

    const localMigrationFiles = await getLocalMigrationFiles();

    const newMigrations = this.getNewMigrations(localMigrationFiles, commitToMigrationFile(logs));

    if (newMigrations.length === 0) {
      this.log('No new migrations to push');
      return;
    }

    if (flags['dry-run']) {
      this.log('The following migrations would be pushed:');
      newMigrations.forEach((migration) => {
        this.log(`  ${migration.id}`);
      });
      return;
    }

    // TODO: Check for errors and print them
    await xata.api.migrations.pushBranchMigrations({ workspace, region, database, branch, migrations: newMigrations });

    this.log(`Pushed ${newMigrations.length} migrations to ${branch}`);
  }

  getNewMigrations(
    localMigrationFiles: Schemas.MigrationObject[],
    remoteMigrationFiles: Schemas.MigrationObject[]
  ): Schemas.MigrationObject[] {
    if (localMigrationFiles.length === 0 && remoteMigrationFiles.length > 0) {
      this.log('There are new migrations on the remote branch. Please run `xata pull` to get the latest migrations.');
      this.exit(0);
    }

    const lastCommonMigrationIndex = remoteMigrationFiles.reduce((index, remoteMigration) => {
      if (remoteMigration.id === localMigrationFiles[index + 1]?.id) {
        return index + 1;
      }

      return index;
    }, -1);

    const newLocalMigrations = localMigrationFiles.slice(lastCommonMigrationIndex + 1);
    const newRemoteMigrations = remoteMigrationFiles.slice(lastCommonMigrationIndex + 1);

    if (newLocalMigrations.length === 0 && newRemoteMigrations.length > 0) {
      this.log('There are new migrations on the remote branch. Please run `xata pull` to get the latest migrations.');
      this.exit(0);
    }

    if (newLocalMigrations.length > 0 && newRemoteMigrations.length > 0) {
      this.log(
        'There are new migrations on both the local and remote branches. Please run `xata rebase` to resolve the conflicts.'
      );
      this.exit(0);
    }

    return newLocalMigrations;
  }
}
