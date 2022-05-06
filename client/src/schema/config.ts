// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="./global-node.d.ts"/>

import { getBranchDetails } from '../api';
import { FetcherExtraProps } from '../api/fetcher';

const XATA_BRANCH = 'XATA_BRANCH';
const XATA_DATABASE_URL = 'XATA_DATABASE_URL';
const XATA_API_KEY = 'XATA_API_KEY';

export async function getBranch(fetchProps: FetcherExtraProps) {
  const env = (await getEnvNode(XATA_BRANCH)) || (await getEnvDeno(XATA_BRANCH));
  if (env) return env;

  const branch = (await getGitBranchhNode()) || (await getGitBranchDeno());
  if (!branch) return;

  // TODO: in the future, call /resolve endpoint
  // For now, call API to see if the branch exists. If not, use a default value.

  const [protocol, , host, , database] = fetchProps.apiUrl.split('/');
  const [workspace] = host.split('.');
  const dbBranchName = `${database}:${branch}`;
  try {
    await getBranchDetails({
      ...fetchProps,
      workspacesApiUrl: `${protocol}//${host}`,
      pathParams: {
        dbBranchName,
        workspace
      }
    });
  } catch (err) {
    if (typeof err === 'object' && (err as Record<string, unknown>).status === 404) return 'main';
    throw err;
  }

  return branch;
}

function getEnvNode(name: string): string | undefined {
  if (typeof process !== 'object') return;
  return process.env[name];
}

function getEnvDeno(name: string): string | undefined {
  if (typeof Deno !== 'object') return;
  try {
    return Deno.env.get(name);
  } catch (err) {
    // Ignore
    // Will fail if not using --allow-env
  }
}

async function getGitBranchhNode(): Promise<string | undefined> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('child_process').execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch (err) {
    // Ignore
  }
}

async function getGitBranchDeno(): Promise<string | undefined> {
  if (typeof Deno !== 'object') return;
  try {
    const process = Deno.run({
      cmd: ['git', 'branch', '--show-current'],
      stdout: 'piped',
      stderr: 'piped'
    });
    return new TextDecoder().decode(await process.output()).trim();
  } catch (err) {
    // Ignore
    // Will fail if not using --allow-run
  }
}

export function getDatabaseUrl() {
  return getEnvNode(XATA_DATABASE_URL) || getEnvDeno(XATA_DATABASE_URL);
}

export function getAPIKey() {
  return getEnvNode(XATA_API_KEY) || getEnvDeno(XATA_API_KEY);
}
