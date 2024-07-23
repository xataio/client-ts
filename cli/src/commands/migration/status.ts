import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';
import chalk from 'chalk';
import { match } from 'ts-pattern';

export default class MigrationStatus extends BaseCommand<typeof MigrationStatus> {
  static description = 'Get the status of the last pgroll migration';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to fetch the status for', required: true })
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

    const migrationJobStatus = await xata.api.migrations.getBranchMigrationJobStatus({
      pathParams: {
        ...commonParams
      }
    });

    if (Object.keys(migrationJobStatus).length === 0) {
      this.error(
        `No migrations found. Please create a new migration with "${chalk.gray(
          'xata migrate start <branch-name>'
        )}" command.`
      );
    }

    const statusChalkColor = match(migrationJobStatus.status)
      .with('completed', () => chalk.green)
      .with('failed', () => chalk.red)
      .with('in_progress', () => chalk.cyan)
      .with('pending', () => chalk.cyan)
      .exhaustive();

    const migrationStatus = match({ type: migrationJobStatus.type, status: migrationJobStatus.status })
      .with({ type: 'start', status: 'completed' }, () => 'active')
      .otherwise(() => migrationJobStatus.status);

    const tableHeaders = ['Job ID', 'Type', 'Job Status', 'Migration Status', 'Completed At'];
    const tableRows = [
      [
        chalk.cyan(migrationJobStatus.jobID),
        chalk.cyan(migrationJobStatus.type),
        statusChalkColor(migrationJobStatus.status),
        statusChalkColor(migrationStatus),
        migrationJobStatus.completedAt ?? ''
      ]
    ];

    if (migrationJobStatus.error) {
      tableHeaders.push('Error');
      tableRows[0].push(migrationJobStatus.error);
    }

    this.printTable(tableHeaders, tableRows);
    this.log();
  }
}
