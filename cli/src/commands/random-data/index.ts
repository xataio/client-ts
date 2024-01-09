import { Flags } from '@oclif/core';
import { generateRandomData } from '@xata.io/importer';
import chalk from 'chalk';
import { BaseCommand } from '../../base.js';
import { pluralize } from '../../utils.js';
import { getBranchDetailsWithPgRoll } from '../../migrations/pgroll.js';

export default class RandomData extends BaseCommand<typeof RandomData> {
  static description = 'Insert random data in the database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag,
    records: Flags.integer({
      description: 'Number of records to generate per table',
      default: 25
    }),
    table: Flags.string({
      description: 'Table in which to add data (default: all). Can be specified multiple times',
      multiple: true
    })
  };

  static args = {};

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    const xata = await this.getXataClient();
    const branchDetails = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });
    if (!branchDetails) {
      this.error('Could not resolve the current branch');
    }

    const { tables: schemaTables } = branchDetails.schema;
    if (schemaTables.length === 0) {
      this.warn(
        `Your database has no tables. To create one, use ${chalk.bold(
          'xata schema edit'
        )}. Once your database has at least one table, running this command again will generate random data for you.`
      );
      this.log();
    }

    const { table: tablesFlag = [], records: totalRecords = 25 } = flags;
    const tables = tablesFlag.length > 0 ? schemaTables.filter((t) => tablesFlag.includes(t.name)) : schemaTables;

    for (const table of tables) {
      const records = generateRandomData(table, totalRecords);

      await xata.api.records.bulkInsertTableRecords({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table.name },
        body: { records: records as any[] }
      });

      this.info(
        `Inserted ${chalk.bold(totalRecords)} random ${pluralize('record', totalRecords)} in the ${chalk.bold(
          table.name
        )} table`
      );
    }

    this.success(
      `Inserted ${chalk.bold(tables.length * totalRecords)} random records across ${chalk.bold(
        tables.length
      )} ${pluralize('table', tables.length)}`
    );
  }
}
