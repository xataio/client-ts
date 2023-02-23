import { Args } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import deepmerge from 'deepmerge';
import { BaseCommand } from '../../base.js';
import Codegen from '../codegen/index.js';

export default class Merge extends BaseCommand<typeof Merge> {
  static description = 'Merge the current branch with another branch';

  static examples = [];

  static flags = {};

  static args = {
    branch: Args.string({ description: 'The branch to merge the current branch with', required: true })
  };

  async run(): Promise<Schemas.Schema | undefined> {
    const { args } = await this.parseCommand();
    const { branch } = args;

    const { workspace, region, database, branch: current } = await this.getParsedDatabaseURLWithBranch();
    const xata = await this.getXataClient();
    const currentBranchDetails = await xata.api.branches.getBranchDetails({
      workspace,
      region,
      database,
      branch: current
    });
    if (!currentBranchDetails) return this.error('Could not resolve the current branch');
    const otherBranchDetails = await xata.api.branches.getBranchDetails({ workspace, region, database, branch });
    if (!otherBranchDetails) return this.error(`Could not find branch ${branch}`);

    // This is a temporary solution. In the future the backend will provide and endpoint to do a smarter merge
    const finalSchema = deepmerge(currentBranchDetails.schema, otherBranchDetails.schema);

    await this.deploySchema(workspace, region, database, currentBranchDetails.branchName, finalSchema);

    await Codegen.runIfConfigured(this.projectConfig);

    this.success('Done. You are all set!');
  }
}
