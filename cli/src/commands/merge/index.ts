import { getCurrentBranchDetails, Schemas } from '@xata.io/client';
import fetch from 'node-fetch';
import { BaseCommand } from '../../base.js';
import deepmerge from 'deepmerge';
import Codegen from '../codegen/index.js';

export default class Merge extends BaseCommand {
  static description = 'Merge the current branch with another branch';

  static examples = [];

  static flags = {};

  static args = [{ name: 'branch', description: 'The branch to merge the current branch with', required: true }];

  async run(): Promise<Schemas.Schema | undefined> {
    const { args } = await this.parse(Merge);
    const { branch } = args;

    const { workspace, database, databaseURL } = await this.getParsedDatabaseURL();
    const xata = await this.getXataClient();
    const currentBranchDetails = await getCurrentBranchDetails({ fetchImpl: fetch, databaseURL });
    if (!currentBranchDetails) return this.error('Could not resolve the current branch');
    const otherBranchDetails = await xata.branches.getBranchDetails(workspace, database, branch);
    if (!otherBranchDetails) return this.error(`Could not find branch ${branch}`);

    // This is a temporary solution. In the future the backend will provide and endpoint to do a smarter merge
    const finalSchema = deepmerge(currentBranchDetails.schema, otherBranchDetails.schema);

    await this.deploySchema(workspace, database, currentBranchDetails.branchName, finalSchema);

    await Codegen.runIfConfigured(this.projectConfig);

    this.log('Done. You are all set!');
  }
}
