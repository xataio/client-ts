import { getBranchDetails, resolveBranch } from '../api';
import { FetchImpl } from '../api/fetcher';
import { getAPIKey } from './apiKey';
import { getEnvVariable, getGitBranch } from './environment';
import { getFetchImplementation } from './fetch';
import { isObject } from './lang';

const envBranchNames = [
  'XATA_BRANCH',
  'VERCEL_GIT_COMMIT_REF', // Vercel
  'CF_PAGES_BRANCH', // Cloudflare Pages
  'BRANCH' // Netlify. Putting it the last one because it is more ambiguous
];

type BranchResolutionOptions = {
  databaseURL?: string;
  apiKey?: string;
  fetchImpl?: FetchImpl;
};

export async function getCurrentBranchName(options?: BranchResolutionOptions): Promise<string> {
  const env = getBranchByEnvVariable();
  if (env) {
    const details = await getDatabaseBranch(env, options);
    if (details) return env;

    console.warn(`Branch ${env} not found in Xata. Ignoring...`);
  }

  const gitBranch = await getGitBranch();
  return resolveXataBranch(gitBranch, options);
}

export async function getCurrentBranchDetails(options?: BranchResolutionOptions) {
  const branch = await getCurrentBranchName(options);
  return getDatabaseBranch(branch, options);
}

async function resolveXataBranch(gitBranch: string | undefined, options?: BranchResolutionOptions): Promise<string> {
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

  const [protocol, , host, , dbName] = databaseURL.split('/');
  const [workspace] = host.split('.');

  const { branch } = await resolveBranch({
    apiKey,
    apiUrl: databaseURL,
    fetchImpl: getFetchImplementation(options?.fetchImpl),
    workspacesApiUrl: `${protocol}//${host}`,
    pathParams: { dbName, workspace },
    queryParams: { gitBranch, fallbackBranch: getEnvVariable('XATA_FALLBACK_BRANCH') }
  });

  return branch;
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
