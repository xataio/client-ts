import { getCurrentBranchDetails, getDatabaseURL } from '@xata.io/client';
import fetch from 'cross-fetch';
import { exitWithError } from './errors.js';
import { generateWithOutput } from './generateWithOutput.js';
import { parseSchemaFile } from './schema.js';

export async function generateFromAPI(out: string, databaseURL?: string, apiKey?: string) {
  databaseURL = databaseURL || getDatabaseURL();
  if (!databaseURL) {
    return exitWithError(
      'Could not calculate the databaseURL. Either use XATA_DATABASE_URL or pass it as an argument.'
    );
  }
  const branchDetails = await getCurrentBranchDetails({ databaseURL, apiKey, fetchImpl: fetch });
  if (!branchDetails) {
    return exitWithError('Could not load the schema for the current branch.');
  }
  const schema: ReturnType<typeof parseSchemaFile> = {
    ...branchDetails.schema,
    formatVersion: '1.0'
  };
  try {
    await generateWithOutput({ schema, databaseURL, outputFilePath: out });
  } catch (e) {
    exitWithError(e);
  }
}
