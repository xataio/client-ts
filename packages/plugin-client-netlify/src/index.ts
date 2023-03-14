import type { OnPreBuild } from '@netlify/build';
import { buildPreviewBranchName } from '@xata.io/client';

export const onPreBuild: OnPreBuild = async function ({ netlifyConfig, utils }) {
  if (netlifyConfig.build.environment.CONTEXT !== 'deploy-preview') {
    console.log('Not a deploy preview, skipping Xata plugin');
    return;
  }

  if (netlifyConfig.build.environment.XATA_PREVIEW !== 'netlify') {
    console.log('XATA_PREVIEW is not set to netlify, skipping Xata plugin');
    return;
  }

  console.log(JSON.stringify(netlifyConfig, null, 2));

  const { stdout: gitHead, stderr } = await utils.run('git', ['rev-parse', 'HEAD']);
  if (!gitHead || stderr) {
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
