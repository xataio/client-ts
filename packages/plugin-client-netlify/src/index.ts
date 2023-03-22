import type { OnPreBuild } from '@netlify/build';
import { buildPreviewBranchName } from '@xata.io/client';
import babel from '@babel/core';
import path from 'path';
import fs from 'fs/promises';

export const onPreBuild: OnPreBuild = async function ({ netlifyConfig }) {
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

  console.log(process.env);

  // TODO: get org from netlify config
  const org = 'SferaDev';
  if (!org) {
    console.log('No GitHub owner found, skipping Xata plugin');
    return;
  }

  const previewBranch = buildPreviewBranchName({ org, branch });

  const xataBuildDir = [process.cwd(), 'node_modules', '@xata.io/client', 'dist'];
  const xataClientFiles = [path.join(...xataBuildDir, 'index.mjs'), path.join(...xataBuildDir, 'index.cjs')];

  let success = false;
  for (const xataClientFile of xataClientFiles) {
    try {
      const result = await babel.transformFileAsync(xataClientFile, {
        plugins: [transformGetPreviewBranch(previewBranch)]
      });

      if (result?.code) {
        success = true;
        await fs.writeFile(xataClientFile, result.code);
      }
    } catch {
      // Do nothing
    }
  }

  if (success) {
    console.log(`Using "${previewBranch}" as deploy preview branch`);
  } else {
    console.log(`Failed to inject "${previewBranch}" as deploy preview branch`);
  }
};

/**
 * Babel transformer to replace `getPreviewBranch`'s block statement with a hardcoded value.
 */
function transformGetPreviewBranch(gitBranch: string) {
  const { types: t } = babel;

  return (): babel.PluginItem => ({
    name: 'transformGetPreviewBranch',
    visitor: {
      FunctionDeclaration({ node }: { node: babel.types.FunctionDeclaration }) {
        if (node.id?.name === 'getPreviewBranch') {
          node.body = t.blockStatement([t.returnStatement(t.stringLiteral(gitBranch))]);
        }
      }
    }
  });
}
