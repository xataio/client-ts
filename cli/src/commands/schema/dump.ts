import { Flags, ux } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { writeFile } from 'fs/promises';
import { BaseCommand } from '../../base.js';

export default class SchemaDump extends BaseCommand<typeof SchemaDump> {
  static description = 'Dump the schema as a JSON file';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag,
    file: Flags.string({ char: 'f', description: 'File to write the schema to' })
  };

  static args = {};

  async run(): Promise<Schemas.Schema | undefined> {
    const { flags } = await this.parseCommand();

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);

    const xata = await this.getXataClient();
    const branchDetails = await xata.api.branch.getBranchDetails({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` }
    });
    if (!branchDetails) return this.error('Could not resolve the current branch');
    if (!flags.file) {
      ux.styledJSON(branchDetails.schema);
      return branchDetails.schema;
    }

    await writeFile(flags.file, JSON.stringify(branchDetails.schema, null, 2));
  }
}
