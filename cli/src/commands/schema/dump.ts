import { Flags } from '@oclif/core';
import { getCurrentBranchDetails } from '@xata.io/client';
import { BaseCommand } from '../../base.js';
import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { Schemas } from '@xata.io/client';

export default class SchemaDump extends BaseCommand {
  static description = 'Dump the schema as a JSON file';

  static examples = [];

  static flags = {
    file: Flags.string({ char: 'f', description: 'File to write the schma to' })
  };

  static args = [];

  async run(): Promise<Schemas.Schema | undefined> {
    const { flags } = await this.parse(SchemaDump);

    const { databaseURL } = await this.getParsedDatabaseURL();
    const branchDetails = await getCurrentBranchDetails({ fetchImpl: fetch, databaseURL });
    if (!branchDetails) return this.error('Could not resolve the current branch');
    if (!flags.file) return branchDetails.schema;

    await writeFile(flags.file, JSON.stringify(branchDetails.schema, null, 2));
  }

  // By default the output is a JSON document. This removes the need to use --json
  // to get the oclif JSON output functionality and coloring.
  jsonEnabled() {
    return true;
  }
}
