import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import { commitToMigrationFile, getLocalMigrationFiles } from '../../migrations/files.js';

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

    const { logs } = await xata.api.migrations.getBranchSchemaHistory({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: {
        // TODO: Fix pagination in the API to start from last known migration and not from the beginning
        // Also paginate until we get all migrations
        page: { size: 200 }
      }
    });

    const localMigrationFiles = await getLocalMigrationFiles();

    // TODO remove type assertion
    const newMigrations = this.getNewMigrations(
      localMigrationFiles as Schemas.MigrationObject[],
      commitToMigrationFile(logs) as Schemas.MigrationObject[]
    );

    if (newMigrations.length === 0) {
      this.log('No new migrations to push');
      return;
    }

    newMigrations.forEach((migration) => {
      this.log(`  ${migration.id}`);
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

    // TODO: Check for errors and print them
    await xata.api.migrations.pushBranchMigrations({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { migrations: newMigrations }
    });

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
        'There are new migrations both locally and in the remote branch. Please run `xata pull -f` to overwrite local migrations.'
      );
      this.exit(0);
    }

    return newLocalMigrations;
  }
}
