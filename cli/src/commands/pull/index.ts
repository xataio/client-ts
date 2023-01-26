import { Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import { getLocalMigrationFiles, removeLocalMigrations, writeLocalMigrationFiles } from '../../migrations/files.js';
import { MigrationFile } from '../../migrations/schema.js';

export default class Pull extends BaseCommand {
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

  static args = [
    {
      name: 'branch',
      description: 'The remote branch to push to',
      required: false
    }
  ];

  static hidden = true;

  async run() {
    const { args, flags } = await this.parse(Pull);

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      args.branch ?? 'main',
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

    const newMigrations = this.getNewMigrations(localMigrationFiles, this.getMigrationFiles(logs));
    await writeLocalMigrationFiles(newMigrations);

    if (newMigrations.length > 0) {
      this.log(`Successfully pulled ${newMigrations.length} migrations from ${branch} branch`);
    } else {
      this.log(`No new migrations to pull from ${branch} branch`);
    }
  }

  getMigrationFiles(logs: Schemas.Commit[]): MigrationFile[] {
    // Schema history comes in reverse order, so we need to reverse it
    return logs.reverse().map((log) => ({
      id: log.id,
      parent: log.parentID ?? '',
      // TODO: Get the actual checksum
      checksum: '',
      operations: log.operations
    }));
  }

  getNewMigrations(localMigrationFiles: MigrationFile[], remoteMigrationFiles: MigrationFile[]): MigrationFile[] {
    const lastCommonMigrationIndex =
      remoteMigrationFiles.reduce((index, remoteMigration) => {
        console.log(remoteMigration.id, localMigrationFiles[index + 1]?.id);
        if (remoteMigration.id === localMigrationFiles[index + 1]?.id) {
          return index + 1;
        }

        return index;
      }, -1) + 1;

    const newLocalMigrations = localMigrationFiles.slice(lastCommonMigrationIndex + 1);
    const newRemoteMigrations = remoteMigrationFiles.slice(lastCommonMigrationIndex + 1);

    if (newLocalMigrations.length > 0 && newRemoteMigrations.length > 0) {
      this.error(
        'There are new migrations on both the local and remote branches. Please run `xata rebase` to resolve the conflicts.'
      );
    }

    return newRemoteMigrations;
  }
}
