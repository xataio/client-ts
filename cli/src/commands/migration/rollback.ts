import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';
import chalk from 'chalk';
import { isActiveMigration } from '../../utils/migration.js';

export default class MigrationRollback extends BaseCommand<typeof MigrationRollback> {
  static description = 'Rollback an active migration';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to rollback the migration in', required: true })
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

    const details = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });

    if (!isBranchPgRollEnabled(details)) {
      this.error(`"${chalk.gray('xata migration')}" commands are only supported in Postgres enabled databases`);
    }

    const commonParams = {
      region,
      workspace,
      dbBranchName: `${database}:${branch}`
    };

    const jobStatus = await xata.api.migrations.getBranchMigrationJobStatus({
      pathParams: {
        ...commonParams
      }
    });

    const isActive = isActiveMigration(jobStatus);
    if (!isActive) {
      this.error(`No active migration found, there is nothing to rollback.`);
    }

    const migrationJob = await xata.api.migrations.rollbackMigration({
      pathParams: {
        ...commonParams
      }
    });

    this.log(
      `Migration rollback started with Job ID ${chalk.cyan(migrationJob.jobID)}. Please use the "${chalk.gray(
        `xata migration status ${branch}`
      )}" command to check its status`
    );
    this.log();
  }
}
