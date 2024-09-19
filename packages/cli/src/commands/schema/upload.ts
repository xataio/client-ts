import { Args, Flags } from '@oclif/core';
import { readFile } from 'fs/promises';
import { BaseCommand } from '../../base.js';
import {
  getBranchDetailsWithPgRoll,
  isBranchPgRollEnabled,
  xataToPgroll,
  waitForMigrationToFinish
} from '../../migrations/pgroll.js';
import { compareSchemas } from '../../utils/compareSchema.js';

export default class UploadSchema extends BaseCommand<typeof UploadSchema> {
  static description = 'Apply a schema to the current database from file';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    ...this.yesFlag,
    branch: this.branchFlag,
    'create-only': Flags.boolean({
      description: 'Only initialize the schema if it does not already exist',
      default: false
    })
  };

  static args = {
    file: Args.string({ description: 'Schema file to upload', required: true })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parseCommand();

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      flags.branch,
      true
    );

    const xata = await this.getXataClient();

    const details = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });
    if (flags['create-only'] && details.schema.tables.length > 0) {
      this.info(
        'Schema already exists. `xata schema upload --init` will only initialize the schema if it does not already exist.'
      );
      return;
    }

    const schema = JSON.parse(await readFile(args.file, 'utf8'));

    if (isBranchPgRollEnabled(details)) {
      const { edits } = compareSchemas(xataToPgroll(details), xataToPgroll(schema));

      if (edits.length === 0) {
        this.info('Schema is up to date');
        return;
      }

      this.log(JSON.stringify(edits, null, 2));

      const { confirm } = await this.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Do you want to apply the above migration into the ${branch} branch?`,
        initial: true
      });
      if (!confirm) return this.exit(1);

      const { jobID } = await xata.api.migrations.applyMigration({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: { operations: edits, adaptTables: true }
      });
      await waitForMigrationToFinish(xata.api, workspace, region, database, branch, jobID);
    } else {
      if (!Array.isArray(schema.tables)) {
        this.error('Schema file does not contain a "tables" property');
      }

      const { edits } = await xata.api.migrations.compareBranchWithUserSchema({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: { schema }
      });

      if (edits.operations.length === 0) {
        this.info('Schema is up to date');
        return;
      }

      this.printMigration({ edits });
      this.log();

      const { confirm } = await this.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Do you want to apply the above migration into the ${branch} branch?`,
        initial: true
      });
      if (!confirm) return this.exit(1);

      await xata.api.migrations.applyBranchSchemaEdit({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: { edits }
      });
    }
  }
}
