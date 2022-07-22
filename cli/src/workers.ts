import babel, { NodePath, PluginItem } from '@babel/core';
import { CallExpression, FunctionDeclaration } from '@babel/types';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { OutputChunk, rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { virtualFs } from 'rollup-plugin-virtual-fs';

export async function compileWorkers(file: string) {
  const external: string[] = [];
  const functions: Record<string, string> = {};

  babel.transformFileSync(file, {
    presets: ['@babel/preset-typescript'],
    plugins: [
      (): PluginItem => {
        return {
          visitor: {
            ImportDeclaration: {
              enter(path) {
                external.push(path.toString());
              }
            },
            VariableDeclaration: {
              enter() {
                // external.push(path.toString());
              }
            },
            Function: {
              enter(path) {
                if (isXataWorker(path)) {
                  const args = (path.parent as CallExpression).arguments as any[];
                  const workerName = args[0]?.value;
                  if (!workerName || typeof workerName !== 'string') {
                    console.error(`Found a worker without a name in file ${file}`);
                  } else {
                    functions[workerName] = path.toString();
                  }
                }
              }
            }
          }
        };
      }
    ]
  });

  const compiledWorkers = [];

  for (const [name, worker] of Object.entries(functions)) {
    try {
      const bundle = await rollup({
        input: `file://./${file}`,
        output: { file: `file://bundle.js`, format: 'es' },
        plugins: [
          virtualFs({
            memoryOnly: false,
            files: {
              // TODO: Compile real CF Worker here too
              [`./${file}`]: `${external.join('\n')}\n const xataWorker = ${worker}; export { xataWorker };`
            }
          }),
          resolve(),
          commonjs(),
          esbuild({ target: 'es2022' })
        ]
      });

      const { output } = await bundle.generate({});

      compiledWorkers.push({
        name,
        main: output[0].fileName,
        modules: output.map((o) => ({ name: o.fileName, code: (o as OutputChunk).code }))
      });
    } catch (error) {
      console.error(error);
    }
  }

  return compiledWorkers;
}

function isXataWorker(path: NodePath): path is NodePath<FunctionDeclaration> {
  if (!path.parentPath?.isCallExpression()) return false;
  const parent = path.parent as CallExpression;
  if (!('callee' in parent)) return false;
  if (!('name' in parent.callee)) return false;
  return parent.callee.name === 'xataWorker';
}
