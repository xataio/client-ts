import { getBranchDetails, resolveBranch } from '../api';
import { FetchImpl } from '../api/fetcher';
import { getAPIKey } from './apiKey';
import { getEnvironment, getGitBranch } from './environment';
import { getFetchImplementation } from './fetch';
import { isObject } from './lang';

type BranchResolutionOptions = {
  databaseURL?: string;
  apiKey?: string;
  fetchImpl?: FetchImpl;
};

export async function getCurrentBranchName(options?: BranchResolutionOptions): Promise<string> {
  const { branch, envBranch } = getEnvironment();

  if (branch) {
    const details = await getDatabaseBranch(branch, options);
    if (details) return branch;

    console.warn(`Branch ${branch} not found in Xata. Ignoring...`);
  }

  const gitBranch = envBranch || (await getGitBranch());
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
  const { fallbackBranch } = getEnvironment();

  const { branch } = await resolveBranch({
    apiKey,
    apiUrl: databaseURL,
    fetchImpl: getFetchImplementation(options?.fetchImpl),
    workspacesApiUrl: `${protocol}//${host}`,
    pathParams: { dbName, workspace },
    queryParams: { gitBranch, fallbackBranch }
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
      pathParams: { dbBranchName, workspace }
    });
  } catch (err) {
    if (isObject(err) && err.status === 404) return null;
    throw err;
  }
}

export function getDatabaseURL() {
  try {
    const { databaseURL } = getEnvironment();
    return databaseURL;
  } catch (err) {
    return undefined;
  }
}
