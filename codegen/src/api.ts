import { exitWithError } from './errors.js';
import { generateWithOutput } from './generateWithOutput.js';
import { parseSchemaFile } from './schema.js';
import { spinner } from './spinner.js';
import fetch from 'cross-fetch';
import { XataApiClient } from '@xata.io/client';
import { execSync } from 'child_process';

export async function generateFromAPI(databaseUrl: string, apiKey: string, out: string) {
  const branchDetails = await getBranchDetails(databaseUrl, apiKey);
  const schema: ReturnType<typeof parseSchemaFile> = {
    ...branchDetails.schema,
    formatVersion: '1.0'
  };
  try {
    await generateWithOutput({ schema, databaseUrl, outputFilePath: out, spinner });
  } catch (e) {
    exitWithError(e);
  }
}

async function getBranchDetails(databaseUrl: string, apiKey: string) {
  const branch = process.env.XATA_BRANCH || (await getGitBranch()) || 'main';

  const [, , host, , database] = databaseUrl.split('/');
  const [workspace] = host.split('.');

  const api = new XataApiClient({ fetch, apiKey });
  try {
    return await api.branches.getBranchDetails(workspace, database, branch);
  } catch (err) {
    if (err && typeof err === 'object' && (err as any).status === 404) {
      return api.branches.getBranchDetails(workspace, database, 'main');
    }
    throw err;
  }
}

async function getGitBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch (err) {
    return undefined;
  }
}
