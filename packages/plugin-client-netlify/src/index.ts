import type { OnPreBuild } from '@netlify/build';
import { buildPreviewBranchName } from '@xata.io/client';

export const onPreBuild: OnPreBuild = async function ({ netlifyConfig, utils }) {
  const { CONTEXT: context, BRANCH: branch, XATA_PREVIEW: preview } = netlifyConfig.build.environment;

  if (context !== 'deploy-preview') {
    console.log('Not a deploy preview, skipping Xata plugin');
    return;
  }

  if (preview !== 'netlify') {
    console.log('XATA_PREVIEW is not set to netlify, skipping Xata plugin');
    return;
  }

  if (!branch) {
    console.log('No git HEAD found, skipping Xata plugin');
    return;
  }

  // TODO: get org from netlify config
  const org = 'SferaDev';
  if (!org) {
    console.log('No GitHub owner found, skipping Xata plugin');
    return;
  }

  const previewBranch = buildPreviewBranchName({ org, branch });
  netlifyConfig.build.environment.XATA_PREVIEW_BRANCH = previewBranch;
  console.log(`Xata preview branch set to ${previewBranch}`);
};
