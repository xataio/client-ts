import { Args } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';
import chalk from 'chalk';
import { safeJSONParse, safeJSONStringify } from '../../utils/files.js';

export default class MigrationList extends BaseCommand<typeof MigrationList> {
  static description = 'List migrations for a database branch';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to list the migrations for', required: true })
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

    const migrationHistory = await xata.api.migrations.getMigrationHistory({
      pathParams: {
        ...commonParams
      },
      queryParams: {
        limit: 10
      }
    });

    const tableHeaders = ['Name', 'Type', 'Status', 'Parent', 'Migration'];
    const tableRows = migrationHistory.migrations.map((migration) => {
      const TRUNCATE_LIMIT = 70;
      const migrationJson = safeJSONParse(migration.migration);
      const migrationOperationsStr = safeJSONStringify(migrationJson.operations) || '';
      const truncatedStr = migrationOperationsStr.length >= TRUNCATE_LIMIT ? ' (truncated...)' : '';
      return [
        chalk.cyan(migration.name),
        migration.migrationType,
        migration.done ? chalk.green('complete') : chalk.yellow('in progress'),
        chalk.gray(migration.parent),
        migrationOperationsStr.substring(0, TRUNCATE_LIMIT) + chalk.gray(truncatedStr)
      ];
    });

    this.printTable(tableHeaders, tableRows);
    this.log();
  }
}
