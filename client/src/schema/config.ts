import { getBranchDetails } from '../api';
import { FetcherExtraProps } from '../api/fetcher';
import { getEnvVariable, getGitBranch } from '../util/environment';
import { isObject } from '../util/lang';

const envBranchNames = [
  'XATA_BRANCH',
  'VERCEL_GIT_COMMIT_REF', // Vercel
  'CF_PAGES_BRANCH', // Cloudflare Pages
  'BRANCH' // Netlify. Putting it the last one because it is more ambiguous
];

export async function getBranch(fetchProps: Omit<FetcherExtraProps, 'workspacesApiUrl'>): Promise<string | undefined> {
  const env = getBranchByEnvVariable();
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
