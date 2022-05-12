import { getBranchDetails } from '../api';
import { FetchImpl } from '../api/fetcher';
import { getEnvVariable, getGitBranch } from './environment';
import { getFetchImplementation } from './fetch';
import { isObject } from './lang';

const envBranchNames = [
  'XATA_BRANCH',
  'VERCEL_GIT_COMMIT_REF', // Vercel
  'CF_PAGES_BRANCH', // Cloudflare Pages
  'BRANCH' // Netlify. Putting it the last one because it is more ambiguous
];

const defaultBranch = 'main';

type BranchResolutionOptions = {
  databaseURL?: string;
  apiKey?: string;
  fetchImpl?: FetchImpl;
};

export async function getCurrentBranchName(options?: BranchResolutionOptions): Promise<string | undefined> {
  const env = await getBranchByEnvVariable();
  if (env) return env;

  const branch = await getGitBranch();
  if (!branch) return defaultBranch;

  // TODO: in the future, call /resolve endpoint
  // For now, call API to see if the branch exists. If not, use a default value.
  const details = await getDatabaseBranch(branch, options);
  if (details) return branch;

  return defaultBranch;
}

export async function getCurrentBranchDetails(options?: BranchResolutionOptions) {
  const env = await getBranchByEnvVariable();
  if (env) return getDatabaseBranch(env, options);

  const branch = await getGitBranch();
  if (!branch) return getDatabaseBranch(defaultBranch, options);

  // TODO: in the future, call /resolve endpoint
  // For now, call API to see if the branch exists. If not, use a default value.
  const details = await getDatabaseBranch(branch, options);
  if (details) return details;

  return getDatabaseBranch(defaultBranch, options);
}

async function getDatabaseBranch(branch: string, options?: BranchResolutionOptions) {
  const databaseURL = options?.databaseURL || getDatabaseURL();
  const apiKey = options?.apiKey || getAPIKey();

  if (!databaseURL)
    throw new Error(
      'A databaseURL was not defined. Either set the XATA_DATABASE_URL env variable or pass the argument explicitely'
    );
  if (!apiKey)
    throw new Error(
      'An API key was not defined. Either set the XATA_API_KEY env variable or pass the argument explicitely'
    );

  const [protocol, , host, , database] = databaseURL.split('/');
  const [workspace] = host.split('.');
  const dbBranchName = `${database}:${branch}`;
  try {
    return await getBranchDetails({
      apiKey,
      apiUrl: databaseURL,
      fetchImpl: getFetchImplementation(options?.fetchImpl),
      workspacesApiUrl: `${protocol}//${host}`,
      pathParams: {
        dbBranchName,
        workspace
      }
    });
  } catch (err) {
    if (isObject(err) && err.status === 404) return null;
    throw err;
  }
}

function getBranchByEnvVariable(): string | undefined {
  for (const name of envBranchNames) {
    const value = getEnvVariable(name);
    if (value) {
      return value;
    }
  }
  try {
    return XATA_BRANCH;
  } catch (err) {
    // Ignore ReferenceError. Only CloudFlare workers set env variables as global variables
  }
}

export function getDatabaseURL() {
  try {
    return getEnvVariable('XATA_DATABASE_URL') ?? XATA_DATABASE_URL;
  } catch (err) {
    return undefined;
  }
}

export function getAPIKey() {
  try {
    return getEnvVariable('XATA_API_KEY') ?? XATA_API_KEY;
  } catch (err) {
    return undefined;
  }
}
