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

    const { migrations: localMigrationFiles } = await getLocalMigrationFiles();

    const newMigrations = this.getNewMigrations(localMigrationFiles, this.getMigrationFiles(logs));
    await writeLocalMigrationFiles(newMigrations);
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

  // TODO: Improve this logic when backend returns sorted ids
  getNewMigrations(localMigrationFiles: MigrationFile[], remoteMigrationFiles: MigrationFile[]): MigrationFile[] {
    const localMigrationIds = localMigrationFiles.map((file) => file.id);
    return remoteMigrationFiles.filter((file) => !localMigrationIds.includes(file.id));
  }
}
