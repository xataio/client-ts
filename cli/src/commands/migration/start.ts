import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';
import chalk from 'chalk';
import path from 'path';
import { safeJSONParse, safeReadFile } from '../../utils/files.js';

export default class MigrationStart extends BaseCommand<typeof MigrationStart> {
  static description = 'Start a new migration';

  static examples = [];

  static migrationJsonFlag = {
    'migration-json': Flags.string({
      helpValue: `
      [
        {
            "alter_column": {
                "table": "table",
                "column": "text",
                "type": "text",
                "up": "text",
                "down": "text"
            }
        }
    ]`,
      description: 'Migration operations as JSON string'
    })
  };

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    ...this.migrationJsonFlag
  };

  static args = {
    branch: Args.string({ description: 'The branch to start the migration in', required: true }),
    migrationFile: Args.string({ description: 'Migration operations JSON as a file', required: false })
  };

  static hidden = true;

  async run() {
    const { args, flags } = await this.parseCommand();

    if (Boolean(args.migrationFile) && Boolean(flags['migration-json'])) {
      this.error(
        `Both a migration file and an inline migration operation JSON supplied. This is ambiguous, please provide only one of these options`
      );
    }

    if (!args.migrationFile && !flags['migration-json']) {
      this.error(
        `Neither a migration file nor an inline migration operation JSON supplied. Please provide a migration to start.`
      );
    }

    let operationsJson = null;
    if (args.migrationFile) {
      const filePath = path.join(process.cwd(), args.migrationFile);
      const fileContents = await safeReadFile(filePath);
      operationsJson = safeJSONParse(fileContents);
    }
    if (flags['migration-json']) {
      operationsJson = safeJSONParse(flags['migration-json']);
    }

    if (!operationsJson) {
      this.error(`Failed to parse the supplied migration operations JSON string`);
    }

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

    const jobStatus = await xata.api.migrations.getBranchMigrationJobStatus({
      pathParams: {
        ...commonParams
      }
    });

    const isActiveMigration = jobStatus.status === 'completed' && jobStatus.type === 'start';
    if (isActiveMigration) {
      this.error(
        `An existing migration with status ${jobStatus.status} found. There can only be one running migration per branch.`
      );
    }

    const migrationJob = await xata.api.migrations.startMigration({
      pathParams: {
        ...commonParams
      },
      body: {
        operations: operationsJson
      }
    });

    this.log(
      `Migration started with Job ID ${chalk.cyan(migrationJob.jobID)}. Please use the ${chalk.gray(
        `xata migration status ${branch}`
      )} command to check its status`
    );

    if (args.migrationFile) {
      this.log(`You can now safely delete the temporary migrations file ${chalk.gray(args.migrationFile)}`);
    }
    this.log();
  }
}
