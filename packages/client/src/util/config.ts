import { getBranchDetails, parseWorkspacesUrlParts, resolveBranch } from '../api';
import { defaultTrace } from '../schema/tracing';
import { getAPIKey } from './apiKey';
import { getEnvironment, getGitBranch } from './environment';
import { FetchImpl, getFetchImplementation } from './fetch';
import { isObject } from './lang';

type BranchResolutionOptions = {
  databaseURL?: string;
  apiKey?: string;
  fetchImpl?: FetchImpl;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
};

export async function getCurrentBranchName(options?: BranchResolutionOptions): Promise<string> {
  const { branch, envBranch } = getEnvironment();

  // If branch provided in env, use it
  if (branch) return branch;

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
  const urlParts = parseWorkspacesUrlParts(host);
  if (!urlParts) throw new Error(`Unable to parse workspace and region: ${databaseURL}`);
  const { workspace, region } = urlParts;

  const { fallbackBranch } = getEnvironment();

  const { branch } = await resolveBranch({
    apiKey,
    apiUrl: databaseURL,
    fetchImpl: getFetchImplementation(options?.fetchImpl),
    workspacesApiUrl: `${protocol}//${host}`,
    pathParams: { dbName, workspace, region },
    queryParams: { gitBranch, fallbackBranch },
    trace: defaultTrace,
    clientName: options?.clientName,
    xataAgentExtra: options?.xataAgentExtra
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
  const urlParts = parseWorkspacesUrlParts(host);
  if (!urlParts) throw new Error(`Unable to parse workspace and region: ${databaseURL}`);
  const { workspace, region } = urlParts;

  try {
    return await getBranchDetails({
      apiKey,
      apiUrl: databaseURL,
      fetchImpl: getFetchImplementation(options?.fetchImpl),
      workspacesApiUrl: `${protocol}//${host}`,
      pathParams: { dbBranchName: `${database}:${branch}`, workspace, region },
      trace: defaultTrace
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
