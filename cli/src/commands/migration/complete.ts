import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';
import chalk from 'chalk';

export default class MigrationComplete extends BaseCommand<typeof MigrationComplete> {
  static description = 'Start a new migration';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to complete the migration in', required: true })
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
      this.error(`${chalk.gray('xata migration')} commands are only supported in Postgres enabled databases`);
    }

    const commonParams = {
      region,
      workspace,
      dbBranchName: `${database}:${branch}`
    };

    const migrationJobStatus = await xata.api.migrations.getBranchMigrationJobStatus({
      pathParams: {
        ...commonParams
      }
    });

    const isActiveMigration = migrationJobStatus.status === 'completed' && migrationJobStatus.type === 'start';
    if (!isActiveMigration) {
      this.error(`No active migration found, there is nothing to complete.`);
    }

    const migrationJob = await xata.api.migrations.completeMigration({
      pathParams: {
        ...commonParams
      }
    });

    this.log(
      `Migration complete started with Job ID ${chalk.cyan(migrationJob.jobID)}. Please use the ${chalk.gray(
        `xata migration status ${branch}`
      )} command to check its status`
    );
    this.log();
  }
}
