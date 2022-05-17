import { getCurrentBranchDetails, getDatabaseURL, FetchImpl } from '@xata.io/client';
import { fetch } from 'cross-fetch';
import { generate, Language } from './codegen.js';
import { parseSchemaFile } from './schema.js';

type BranchResolutionOptions = {
  databaseURL?: string;
  apiKey?: string;
  fetchImpl?: FetchImpl;
};

export async function generateFromAPI(language: Language, options?: BranchResolutionOptions) {
  const resolvedOptions = { ...options };
  resolvedOptions.databaseURL = resolvedOptions.databaseURL || getDatabaseURL();
  resolvedOptions.fetchImpl = resolvedOptions.fetchImpl || fetch;

  if (!resolvedOptions.databaseURL) {
    throw new Error('Could not calculate the databaseURL. Either use XATA_DATABASE_URL or pass it as an argument.');
  }
  const branchDetails = await getCurrentBranchDetails(resolvedOptions);
  if (!branchDetails) {
    throw new Error('Could not load the schema for the current branch.');
  }
  const schema: ReturnType<typeof parseSchemaFile> = {
    ...branchDetails.schema,
    formatVersion: '1.0'
  };

  return generate({ schema, databaseURL: resolvedOptions.databaseURL, language });
}
