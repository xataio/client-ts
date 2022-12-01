import babel, { NodePath, PluginItem } from '@babel/core';
// @ts-ignore
import presetTypeScript from '@babel/preset-typescript';
// @ts-ignore
import presetReact from '@babel/preset-react';
import type { CallExpression, FunctionDeclaration } from '@babel/types';
import commonjs from '@rollup/plugin-commonjs';
import virtual from '@rollup/plugin-virtual';
import chokidar from 'chokidar';
import { readFile } from 'fs/promises';
import fetch from 'node-fetch';
import { OutputChunk, rollup } from 'rollup';
import { importCdn } from 'rollup-plugin-import-cdn';
import ts from 'typescript';
import { z } from 'zod';

type BuildWatcherOptions<T> = {
  compile: (path: string) => Promise<T[]>;
  run?: (modules: T[]) => Promise<() => Promise<void>>;
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

export function buildWatcher<T extends WorkerScript>({
  compile,
  run,
  included = watcherIncludePaths,
  ignored = watcherIgnorePaths
}: BuildWatcherOptions<T>): { watcher: chokidar.FSWatcher } {
  const watcher = chokidar.watch(included, { ignored, cwd: process.cwd() });

  let stopServer: () => Promise<void> | undefined;
  const modules: Record<string, T[]> = {};

  const updateModule = async (path: string) => {
    modules[path] = await compile(path);
    if (run) {
      if (stopServer) await stopServer();
      stopServer = await run(Object.values(modules).flat());
    }
  };

  watcher
    .on('add', async (path) => {
      console.log(`[watcher] add ${path}`);
      modules[path] = await compile(path);
    })
    .on('change', async (path) => {
      console.log(`[watcher] change ${path}`);
      await updateModule(path);
    })
    .on('error', (error) => {
      console.error(`[watcher] error ${error}`);
      throw new Error('Watcher error');
    })
    .on('ready', async () => {
      console.log('[watcher] ready');
      if (run) {
        stopServer = await run(Object.values(modules).flat());
      }
    });

  return { watcher };
}

export async function compileWorkers(file: string): Promise<WorkerScript[]> {
  const external: string[] = [];
  const functions: Record<string, string> = {};

  try {
    babel.transformFileSync(file, {
      presets: [presetTypeScript, presetReact],
      plugins: [
        (): PluginItem => {
          return {
            visitor: {
              ImportDeclaration: {
                enter(path) {
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
  } catch (e) {
    console.error(e);
    return [];
  }

  const versions = await getDependencyVersions();

  const compiledWorkers: WorkerScript[] = [];

  for await (const [name, worker] of Object.entries(functions)) {
    console.log(`[watcher] compiling worker ${name} in ${file}`);

    try {
      const code = workerCode(worker, external);
      const { outputText: entry } = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ESNext
        }
      });

      const bundle = await rollup({
        input: 'entry',
        output: { file: `file://bundle.js`, format: 'es' },
        plugins: [importCdn({ fetchImpl: fetch, versions }), virtual({ entry }), commonjs()]
      });

      const { output } = await bundle.generate({});

      compiledWorkers.push({
        name,
        main: output[0].fileName,
        modules: output.map((o) => ({ name: o.fileName, content: (o as OutputChunk).code }))
      });

      console.log(`[watcher] compiled worker ${name} in ${file}`);
    } catch (error) {
      console.error(`[watcher] error compiling worker ${name} in file ${file}`);
      console.error(error);
    }
  }

  return compiledWorkers;
}

async function getDependencyVersions(): Promise<Record<string, string> | undefined> {
  try {
    const packageJson = await readFile('./package.json', 'utf8');
    const { dependencies } = JSON.parse(packageJson);

    return dependencies;
  } catch (e) {
    console.error(`[watcher] error reading package.json`);
    return undefined;
  }
}

function isXataWorker(path: NodePath): path is NodePath<FunctionDeclaration> {
  if (!path.parentPath?.isCallExpression()) return false;
  const parent = path.parent as CallExpression;
  if (!('callee' in parent)) return false;
  if (!('name' in parent.callee)) return false;
  return parent.callee.name === 'xataWorker';
}

function workerCode(code: string, external: string[]) {
  return `
import { BaseClient, deserialize, serialize } from "@xata.io/client";
${external.join('\n')}

const xataWorker = ${code};

const corsHeaders = {
  // TODO: Allow customizing CORS origin
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, environment) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Headers":
            request.headers.get("Access-Control-Request-Headers") ?? "",
        },
      });
    }

    const {
      XATA_API_KEY: apiKey,
      XATA_DATABASE_URL: databaseURL,
      ...env
    } = environment;

    const text = await request.text();
    const body = deserialize(text);
    const args = body.args || [];

    const xata = new BaseClient({ databaseURL, apiKey });
    const result = await xataWorker({ xata, env, request }, ...args);

    const response = result instanceof Response
      ? result
      : new Response(serialize(result));

    // TODO: Allow customizing CORS origin
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Headers", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
    response.headers.set("Access-Control-Max-Age", "86400");

    return response;
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
