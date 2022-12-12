import { Flags } from '@oclif/core';
import { readFile } from 'fs/promises';
import { BaseCommand } from '../../base.js';

export default class UploadSchema extends BaseCommand {
  static description = 'Edit the schema of the current database';

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

  static args = [{ name: 'file', description: 'Schema file to upload', required: true }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(UploadSchema);

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      flags.branch,
      true
    );

    const xata = await this.getXataClient();

    if (flags['create-only']) {
      const { schema } = await xata.branches.getBranchDetails({ workspace, region, database, branch });
      if (schema.tables.length > 0) {
        this.info(
          'Schema already exists. `xata schema upload --init` will only initialize the schema if it does not already exist.'
        );
        return;
      }
    }

    const schema = JSON.parse(await readFile(args.file, 'utf8'));
    if (!Array.isArray(schema.tables)) {
      this.error('Schema file does not contain a "tables" property');
    }

    const { edits } = await xata.migrations.compareBranchWithUserSchema({
      workspace,
      region,
      database,
      branch,
      schema
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

    await xata.migrations.applyBranchSchemaEdit({ workspace, region, database, branch, edits });
  }
}
