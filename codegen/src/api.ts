import { exitWithError } from './errors.js';
import { generateWithOutput } from './generateWithOutput.js';
import { parseSchemaFile } from './schema.js';
import { spinner } from './spinner.js';
import { getCurrentBranchDetails } from '@xata.io/client';
import fetch from 'cross-fetch';

export async function generateFromAPI(databaseURL: string, apiKey: string, out: string) {
  const branchDetails = await getCurrentBranchDetails({ databaseURL, apiKey, fetchImpl: fetch });
  if (!branchDetails) {
    return exitWithError('Could not load the schema of the current branch.');
  }
  const schema: ReturnType<typeof parseSchemaFile> = {
    ...branchDetails.schema,
    formatVersion: '1.0'
  };
  try {
    await generateWithOutput({ schema, databaseURL, outputFilePath: out, spinner });
  } catch (e) {
    exitWithError(e);
  }
}
