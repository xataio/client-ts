import { getBranchDetails } from '../api';
import { FetcherExtraProps } from '../api/fetcher';
import { getEnvVariable, getGitBranch } from '../util/environment';
import { isObject, isString } from '../util/lang';

export async function getBranch(fetchProps: FetcherExtraProps): Promise<string | undefined> {
  const env = isString(XATA_BRANCH) ? XATA_BRANCH : getEnvVariable('XATA_BRANCH');
  if (env) return env;

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
  return isString(XATA_DATABASE_URL) ? XATA_DATABASE_URL : getEnvVariable('XATA_DATABASE_URL');
}

export function getAPIKey() {
  return isString(XATA_API_KEY) ? XATA_API_KEY : getEnvVariable('XATA_API_KEY');
}
