import { getBranchDetails } from '../api';
import { FetcherExtraProps } from '../api/fetcher';
import { getEnvVariable, getGitBranch } from '../util/environment';
import { isObject } from '../util/lang';

export async function getBranch(fetchProps: Omit<FetcherExtraProps, 'workspacesApiUrl'>): Promise<string | undefined> {
  try {
    const env = getEnvVariable('XATA_BRANCH') ?? XATA_BRANCH;
    if (env) return env;
  } catch (err) {
    // Ignore
  }

  const branch = await getGitBranch();
  if (!branch) return undefined;

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
    if (isObject(err) && err.status === 404) return 'main';
    throw err;
  }

  return branch;
}

export function getDatabaseUrl() {
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
