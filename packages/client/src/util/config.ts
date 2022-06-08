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

const defaultBranch = 'main';

type BranchResolutionOptions = {
  databaseURL?: string;
  apiKey?: string;
  fetchImpl?: FetchImpl;
};

export async function getCurrentBranchName(options?: BranchResolutionOptions): Promise<string> {
  const env = getBranchByEnvVariable();
  if (env) return env;

  const gitBranch = await getGitBranch();
  if (!gitBranch) return defaultBranch;

  return resolveApiBranchName(gitBranch, options);
}

export async function getCurrentBranchDetails(options?: BranchResolutionOptions) {
  const env = getBranchByEnvVariable();
  if (env) return getApiBranchDetails(env, options);

  const gitBranch = await getGitBranch();
  if (!gitBranch) return getApiBranchDetails(defaultBranch, options);

  const xataBranch = await resolveApiBranchName(gitBranch, options);

  return getApiBranchDetails(xataBranch, options);
}

async function getApiBranchDetails(branch: string, options?: BranchResolutionOptions) {
  const { apiKey, apiUrl, fetchImpl, workspacesApiUrl, workspace, database } = getFetchProps(options);
  const dbBranchName = `${database}:${branch}`;

  try {
    return await getBranchDetails({
      apiKey,
      apiUrl,
      fetchImpl,
      workspacesApiUrl,
      pathParams: { dbBranchName, workspace }
    });
  } catch (err) {
    if (isObject(err) && err.status === 404) return null;
    throw err;
  }
}

async function resolveApiBranchName(gitBranch: string, options?: BranchResolutionOptions) {
  const { apiKey, apiUrl, fetchImpl, workspacesApiUrl, workspace, database } = getFetchProps(options);

  try {
    const { branch } = await resolveBranch({
      apiKey,
      apiUrl,
      fetchImpl,
      workspacesApiUrl,
      pathParams: { dbName: database, workspace },
      queryParams: { gitBranch }
    });

    return branch;
  } catch (err) {
    console.error("Couldn't resolve xata branch from git", err);
    return defaultBranch;
  }
}

function getFetchProps(options?: BranchResolutionOptions) {
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

  return {
    apiKey,
    apiUrl: databaseURL,
    fetchImpl: getFetchImplementation(options?.fetchImpl),
    workspacesApiUrl: `${protocol}//${host}`,
    workspace,
    database
  };
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
