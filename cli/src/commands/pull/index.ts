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

export default class Pull extends BaseCommand<typeof Pull> {
  static description = 'Push local migrations to a remote Xata branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite local migrations',
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

    if (flags.force) {
      await removeLocalMigrations();
    }

    const localMigrationFiles = await getLocalMigrationFiles();

    const newMigrations = this.getNewMigrations(localMigrationFiles, commitToMigrationFile(logs));
    await writeLocalMigrationFiles(newMigrations);

    if (newMigrations.length === 0) {
      this.log(`No new migrations to pull from ${branch} branch`);
      return;
    }

    this.log(`Successfully pulled ${newMigrations.length} migrations from ${branch} branch`);

    if (this.projectConfig?.codegen) {
      this.log(`Running codegen...`);
      await Codegen.run(['--branch', branch]);
    }
  }

  getNewMigrations(
    localMigrationFiles: Schemas.MigrationObject[],
    remoteMigrationFiles: Schemas.MigrationObject[]
  ): Schemas.MigrationObject[] {
    const lastCommonMigrationIndex = remoteMigrationFiles.reduce((index, remoteMigration) => {
      if (remoteMigration.id === localMigrationFiles[index + 1]?.id) {
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
