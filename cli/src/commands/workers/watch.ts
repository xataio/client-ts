import babel, { NodePath, PluginItem } from '@babel/core';
import { CallExpression, FunctionDeclaration } from '@babel/types';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { BaseClient } from '@xata.io/client';
import chokidar from 'chokidar';
import { EdgeRuntime } from 'edge-runtime';
import http from 'http';
import { AddressInfo } from 'net';
import fetch from 'node-fetch';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { virtualFs } from 'rollup-plugin-virtual-fs';
import url from 'url';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';

export default class WorkersCompile extends BaseCommand {
  static description = 'Extract and compile xata workers';

  static flags = {};

  #workers: Map<string, string> = new Map();

  async run(): Promise<void> {
    const watcher = chokidar.watch(['./**/*.ts', './*.ts'], {
      ignored: [/(^|[/\\])\../, 'dist/*', 'node_modules/*'],
      cwd: process.cwd()
    });

    watcher
      .on('add', async (path) => this.#compile(path))
      .on('change', async (path) => this.#compile(path))
      .on('ready', async () => {
        //if (!flags.watch) await watcher.close();
      });

    const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        if (req.method !== 'POST') {
          res.writeHead(405);
          return res.end();
        }

        const parsedURL = url.parse(req.url ?? '', true);
        if (parsedURL.pathname !== '/') {
          res.writeHead(404);
          return res.end();
        }

        // Read and parse body (JSON)
        const body = await new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch (e) {
              reject(e);
            }
          });
          req.on('error', reject);
        });

        const val = await bodySchema.parseAsync(body);
        const workerFound = this.#workers.get(val.name);
        if (!workerFound) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `Worker ${val.name} not found` }));
        }

        const runtime = new EdgeRuntime({
          extend: (context) => {
            context.args = val.payload ?? [];
            context.xata = new BaseClient({
              databaseURL: 'https://sdk-integration-tests-19v8n2.xata.sh/db/sdk-integration-test-20098',
              branch: 'main',
              fetch,
              apiKey: 'xau_rLoyfNZuTCxTS6xnNsk6OXWJvxRscUup5'
            });

            return context;
          }
        });

        console.log('args', val.payload);

        const result = await runtime.evaluate(
          workerFound.replace('export { xataWorker };', `xataWorker({ xata }, ...args);`)
        );

        // Return JSON response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ body: val, workerFound, result }));
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.toString() }));
      }
    });

    server.listen(64749, () => {
      const { port } = server.address() as AddressInfo;
      console.log(`Server listening on port ${port}`);
    });
  }

  async #compile(file: string): Promise<void> {
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
                enter(path) {
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

    for (const [name, worker] of Object.entries(functions)) {
      console.log('worker', name, worker);
      try {
        const bundle = await rollup({
          input: `file://./${file}`,
          output: { file: `file://bundle.js`, format: 'es' },
          plugins: [
            virtualFs({
              memoryOnly: false,
              files: {
                [`./${file}`]: `${external.join('\n')}\n const xataWorker = ${worker}; export { xataWorker };`
              }
            }),
            resolve(),
            commonjs(),
            esbuild({ target: 'es2022' })
          ]
        });

        const { output } = await bundle.generate({});
        this.#workers.set(name, output[0].code);
      } catch (error) {
        console.error(error);
      }
    }
  }
}

function isXataWorker(path: NodePath): path is NodePath<FunctionDeclaration> {
  if (!path.parentPath?.isCallExpression()) return false;
  const parent = path.parent as CallExpression;
  if (!('callee' in parent)) return false;
  if (!('name' in parent.callee)) return false;
  return parent.callee.name === 'xataWorker';
}

const bodySchema = z.any();
