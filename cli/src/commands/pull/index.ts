import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import {
  LocalMigrationFile,
  commitToMigrationFile,
  getLocalMigrationFiles,
  getMigrationId,
  removeLocalMigrations,
  writeLocalMigrationFiles
} from '../../migrations/files.js';
import { allMigrationsPgRollFormat, isBranchPgRollEnabled } from '../../migrations/pgroll.js';
import Codegen from '../codegen/index.js';

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

    if (flags.force) {
      await removeLocalMigrations();
    }

    if (!flags.force && isBranchPgRollEnabled(details) && !(await allMigrationsPgRollFormat())) {
      const { confirm } = await this.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Your local migration files need reformatting. A one time rewrite is required to continue. Proceed?`,
        initial: true
      });
      if (!confirm) return this.exit(1);
      this.log(`Converting existing migrations to pgroll format from ${branch} branch`);
      await removeLocalMigrations();
    }

    const localMigrationFiles = await getLocalMigrationFiles(isBranchPgRollEnabled(details));

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
    localMigrationFiles: LocalMigrationFile[],
    remoteMigrationFiles: LocalMigrationFile[]
  ): LocalMigrationFile[] {
    const lastCommonMigrationIndex = remoteMigrationFiles.reduce((index, remoteMigration) => {
      if (
        !!getMigrationId(remoteMigration) &&
        getMigrationId(remoteMigration) === getMigrationId(localMigrationFiles[index + 1])
      ) {
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
