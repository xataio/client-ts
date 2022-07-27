import babel, { NodePath, PluginItem } from '@babel/core';
// @ts-ignore
import presetTypeScript from '@babel/preset-typescript';
// @ts-ignore
import presetReact from '@babel/preset-react';
import type { CallExpression, FunctionDeclaration } from '@babel/types';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import chokidar from 'chokidar';
import { OutputChunk, rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import styles from 'rollup-plugin-styles';
import { virtualFs } from 'rollup-plugin-virtual-fs';
import { z } from 'zod';

type BuildWatcherOptions = {
  action: (path: string) => void;
  watch?: boolean;
  included?: Array<string>;
  ignored?: Array<string | RegExp>;
};

const watcherIncludePaths = [
  './**/*.ts',
  './*.ts',
  './**/*.js',
  './*.js',
  './**/*.tsx',
  './*.tsx',
  './**/*.jsx',
  './*.jsx'
];
const watcherIgnorePaths = [/(^|[/\\])\../, 'dist/*', 'node_modules/*'];

export function buildWatcher({
  action,
  watch = true,
  included = watcherIncludePaths,
  ignored = watcherIgnorePaths
}: BuildWatcherOptions) {
  const watcher = chokidar.watch(included, { ignored, cwd: process.cwd() });

  watcher
    .on('add', async (path) => {
      console.log(`Added ${path}`);
      action(path);
    })
    .on('change', async (path) => {
      console.log(`Changed ${path}`);
      action(path);
    })
    .on('ready', async () => {
      console.log('Watcher ready');
      if (!watch) await watcher.close();
    });

  return watcher;
}

export function waitForWatcher(watcher: chokidar.FSWatcher): Promise<void> {
  return new Promise((resolve, reject) => {
    watcher.on('close', resolve);
    watcher.on('error', reject);
  });
}

export async function compileWorkers(file: string) {
  const external: string[] = [];
  const functions: Record<string, string> = {};

  babel.transformFileSync(file, {
    presets: [presetTypeScript, presetReact],
    plugins: [
      (): PluginItem => {
        return {
          visitor: {
            ImportDeclaration: {
              enter(path, state) {
                for (const specifier of path.node.specifiers) {
                  const binding = path.scope.getBinding(specifier.local.name);
                  if (!binding) continue;
                  const refPaths = binding.referencePaths;
                  for (const refPath of refPaths) {
                    const usedInWorker = !!refPath.find((path) => {
                      if (!path.isFunction()) return false;
                      return isXataWorker(path);
                    });

                    if (usedInWorker) {
                      external.push(path.toString());
                    }
                  }
                }
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

  const compiledWorkers: WorkerScript[] = [];
  const defaultWorkerFileName = './_defaultWorker.ts';

  for (const [name, worker] of Object.entries(functions)) {
    try {
      const bundle = await rollup({
        input: `file://${defaultWorkerFileName}`,
        output: { file: `file://bundle.js`, format: 'es' },
        plugins: [
          resolve(),
          commonjs(),
          styles(),
          virtualFs({
            memoryOnly: false,
            extensions: ['.ts', '.tsx', '.js'],
            files: {
              [defaultWorkerFileName]: defaultWorker(file),
              [`./${file}`]: `${external.join('\n')}\n export const xataWorker = ${worker};`
            }
          }),
          esbuild({ target: 'es2022' })
        ]
      });

      const { output } = await bundle.generate({});

      compiledWorkers.push({
        name,
        main: output[0].fileName,
        modules: output.map((o) => ({ name: o.fileName, content: (o as OutputChunk).code }))
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

function defaultWorker(main: string) {
  return `
import { BaseClient } from "@xata.io/client";

export interface Environment {
  XATA_API_KEY: string;
  XATA_DATABASE_URL: string;
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const { xataWorker } = await import("./${main}");

    const {
      XATA_API_KEY: apiKey,
      XATA_DATABASE_URL: databaseURL,
      ...env
    } = environment;

    const xata = new BaseClient({ databaseURL, apiKey });
    const result = await xataWorker({ xata, env, request });

    return result instanceof Response
      ? result
      : new Response(JSON.stringify(result));
  },
};
`;
}

export const workerScriptSchema = z.object({
  name: z.string(),
  main: z.string(),
  modules: z.array(
    z.object({
      name: z.string(),
      content: z.string()
    })
  )
});

export type WorkerScript = z.infer<typeof workerScriptSchema>;
