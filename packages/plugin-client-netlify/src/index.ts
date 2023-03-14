import type { OnPreBuild } from '@netlify/build';
import { buildPreviewBranchName } from '@xata.io/client';

export const onPreBuild: OnPreBuild = async function ({ netlifyConfig, packageJson }) {
  if (netlifyConfig.build.environment.CONTEXT !== 'deploy-preview') {
    console.log('Not a deploy preview, skipping Xata plugin');
    return;
  }

  const hasClient = Object.keys(packageJson.dependencies ?? {}).includes('@xata.io/client');
  if (!hasClient) {
    console.log('@xata.io/client not installed, skipping Xata plugin');
    return;
  }

  if (netlifyConfig.build.environment.XATA_PREVIEW !== 'netlify') {
    console.log('XATA_PREVIEW is not set to netlify, skipping Xata plugin');
    return;
  }

  const gitHead = netlifyConfig.build.environment.HEAD;
  if (!gitHead) {
    console.log('No git HEAD found, skipping Xata plugin');
    return;
  }

  const githubRegex = /^https?:\/\/(?:www\.)?github\.com\/(?<owner>[^/]+)\//;
  const owner = netlifyConfig.build.environment.REPOSITORY_URL?.match(githubRegex)?.groups?.owner;
  if (!owner) {
    console.log('No GitHub owner found, skipping Xata plugin');
    return;
  }

  const previewBranch = buildPreviewBranchName({ org: owner, branch: gitHead });
  netlifyConfig.build.environment.XATA_PREVIEW_BRANCH = previewBranch;
  console.log(`Xata preview branch set to ${previewBranch}`);
};
