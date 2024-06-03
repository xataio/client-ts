import { Config, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import EditSchemaOld from './editOld.js';
import EditSchemaNew from './editNew.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';

export default class EditSchema extends BaseCommand<typeof EditSchema> {
  static description = 'Edit the schema of the current database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag,
    source: Flags.boolean({
      description: 'Edit the schema as a JSON document in your default editor'
    })
  };

  static args = {};

  async run(): Promise<void> {
    const config = await Config.load();

    const { flags } = await this.parseCommand();

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      flags.branch,
      true
    );

    const details = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });

    if (isBranchPgRollEnabled(details)) {
      const editNew = new EditSchemaNew(this.argv, config);
      editNew.launch({
        workspace,
        region,
        database,
        branch
      });
    } else {
      const editOld = new EditSchemaOld(this.argv, config);
      editOld.launch({
        workspace,
        region,
        database,
        branch
      });
    }
  }
}
