import { isObject } from './lang';

function parseEnvironment(environment: any): Record<string, string> {
  try {
    if (typeof environment === 'function') {
      return new Proxy(
        {},
        {
          get(target) {
            return environment(target);
          }
        }
      ) as Record<string, string>;
    }

    if (isObject(environment)) {
      return environment as Record<string, string>;
    }
  } catch (error) {
    // noop
  }

  return {};
}

export function buildPreviewBranchName({ org, branch }: { org: string; branch: string }) {
  return `preview-${org}-${branch}`;
}

export function getDeployPreviewBranch(environment: any) {
  try {
    const { deployPreview, deployPreviewBranch, vercelGitCommitRef, vercelGitRepoOwner } =
      parseEnvironment(environment);
    if (deployPreviewBranch) return deployPreviewBranch;

    switch (deployPreview) {
      case 'vercel': {
        if (!vercelGitCommitRef || !vercelGitRepoOwner) {
          console.warn('XATA_PREVIEW=vercel but VERCEL_GIT_COMMIT_REF or VERCEL_GIT_REPO_OWNER is not valid');
          return undefined;
        }

        return buildPreviewBranchName({ org: vercelGitRepoOwner, branch: vercelGitCommitRef });
      }
    }

    return undefined;
  } catch (err) {
    return undefined;
  }
}
