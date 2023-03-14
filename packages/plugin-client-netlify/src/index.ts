import babel from '@babel/core';
import type { OnPreBuild } from '@netlify/build';
import fs from 'fs/promises';
import path from 'path';

export const onPreBuild: OnPreBuild = async function ({ utils }) {
  const gitHead = process.env.HEAD;
  if (!gitHead) {
    utils.status.show({
      title: 'Xata',
      summary: '[Error] No git HEAD found!'
    });
    console.log('No git HEAD found!');
    return;
  }

  const xataBuildDir = [process.cwd(), 'node_modules', '@xata.io/client', 'dist'];

  const xataClientFiles = [path.join(...xataBuildDir, 'index.mjs'), path.join(...xataBuildDir, 'index.cjs')];

  let success = true;
  for (const xataClientFile of xataClientFiles) {
    if (!success) continue;
    try {
      const result = await babel.transformFileAsync(xataClientFile, {
        plugins: [computeGetGitBranch(gitHead)]
      });

      if (!result?.code) {
        success = false;
        utils.status.show({
          title: 'Xata',
          summary: `[Error] ${xataClientFile} was not transformed!`
        });
        console.log(`${xataClientFile} was not transformed!`);
        return;
      }

      await fs.writeFile(xataClientFile, result.code);
    } catch {
      success = false;
      utils.status.show({
        title: 'Xata',
        summary: `[Error] @xata.io/client package was not found!`
      });
      console.log(`@xata.io/client package was not found!`);
    }
  }

  if (success) {
    utils.status.show({
      title: 'Xata',
      summary: `Inject "${gitHead}" as getGitBranch() output in @xata.io/client`
    });
    console.log(`Inject "${gitHead}" as getGitBranch() output in @xata.io/client`);
  }
};

/**
 * Babel transformer to replace `getGitBranch`'s block statement with any hardcoded value.
 */
function computeGetGitBranch(gitBranch: string) {
  const { types: t } = babel;

  return (): babel.PluginItem => ({
    name: 'computeGetGitBranch',
    visitor: {
      FunctionDeclaration({ node }: any) {
        if (node.id?.name === 'getGitBranch') {
          node.body = t.blockStatement([t.returnStatement(t.stringLiteral(gitBranch))]);
        }
      }
    }
  });
}
