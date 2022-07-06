import babel, { NodePath, PluginItem } from '@babel/core';
import { CallExpression, FunctionDeclaration } from '@babel/types';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import chokidar from 'chokidar';
import crypto from 'crypto';
import http from 'http';
import { AddressInfo } from 'net';
import { OutputChunk, rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { virtualFs } from 'rollup-plugin-virtual-fs';
import url from 'url';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';
import { EdgeRuntime } from 'edge-runtime';
import { BaseClient } from '@xata.io/client';
import fetch from 'node-fetch';

export default class WorkersCompile extends BaseCommand {
  static description = 'Extract and compile xata workers';

  static flags = {};

  #workers: Map<string, any> = new Map();

  async run(): Promise<void> {
    console.log(process.cwd());

    const watcher = chokidar.watch(['./**/*.ts', './*.ts'], {
      ignored: [/(^|[/\\])\../, 'dist/*', 'node_modules/*'],
      cwd: process.cwd()
    });

    watcher
      .on('add', async (path) => {
        console.log(`File ${path} has been added`);
        await this.#compile(path);
      })
      .on('change', (path) => this.#compile(path))
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

        const runtime = new EdgeRuntime({
          extend: (context) => {
            context.xata = new BaseClient({
              databaseURL: 'https://sdk-integration-tests-19v8n2.xata.sh/db/sdk-integration-test-20098',
              branch: 'main',
              fetch,
              apiKey:
                'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3hhdGEuaW8iLCJzdWIiOiJ1c3Jfb2ZmajJmdXAxOTZzbGVnZ2NvbmI1NXAzczgiLCJleHAiOjE2NTcwMTM2NzksImlhdCI6MTY1NzAxMjc3OSwid29ya3NwYWNlcyI6eyIxMmUwMGEiOnsicm9sZSI6Im1haW50YWluZXIifSwiMTl2OG4yIjp7InJvbGUiOiJvd25lciJ9LCJlYzI0NDQiOnsicm9sZSI6Im93bmVyIn0sImZ2bWV0MyI6eyJyb2xlIjoib3duZXIifSwidXEyZDU3Ijp7InJvbGUiOiJvd25lciJ9LCJ2aDA3ZzEiOnsicm9sZSI6Im1haW50YWluZXIifX19.r0mpm8hmq31PCuX23g3XgZBisIh2Xa44xxqiUQyH4n-gKEnLFweXHesamZ8fwQGp28VmJvAFmxiq6Dt6PPv5Dg'
            });
            return context;
          }
        });

        console.log(workerFound);
        const result = await runtime.evaluate(
          workerFound.bundle.replace(
            'export { worker };',
            `const xata = new BaseClient({
              databaseURL: 'https://sdk-integration-tests-19v8n2.xata.sh/db/sdk-integration-test-20098',
              branch: 'main',
              fetch,
              apiKey:
                'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3hhdGEuaW8iLCJzdWIiOiJ1c3Jfb2ZmajJmdXAxOTZzbGVnZ2NvbmI1NXAzczgiLCJleHAiOjE2NTcwMTM2NzksImlhdCI6MTY1NzAxMjc3OSwid29ya3NwYWNlcyI6eyIxMmUwMGEiOnsicm9sZSI6Im1haW50YWluZXIifSwiMTl2OG4yIjp7InJvbGUiOiJvd25lciJ9LCJlYzI0NDQiOnsicm9sZSI6Im93bmVyIn0sImZ2bWV0MyI6eyJyb2xlIjoib3duZXIifSwidXEyZDU3Ijp7InJvbGUiOiJvd25lciJ9LCJ2aDA3ZzEiOnsicm9sZSI6Im1haW50YWluZXIifX19.r0mpm8hmq31PCuX23g3XgZBisIh2Xa44xxqiUQyH4n-gKEnLFweXHesamZ8fwQGp28VmJvAFmxiq6Dt6PPv5Dg'
            });worker(xata, ${val.payload.join(', ')})`
          )
        );

        // Return JSON response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            body: val,
            workerFound,
            result
          })
        );
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
    const functions: Record<string, any> = {};

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
                  external.push(path.toString());
                }
              },
              Function: {
                enter(path) {
                  if (isXataWorker(path)) {
                    const args = (path.parent as CallExpression).arguments as any[];

                    const code = path.toString();
                    const id = crypto.createHash('sha1').update(code).digest('hex').substring(0, 7);

                    // TODO: Read old name, remove old hash, add new hash
                    functions[args[0]?.value ?? id] = {
                      id,
                      code,
                      argsSize: args.length,
                      hash: Buffer.from(code.toString()).toString('base64')
                    };
                  }
                }
              }
            }
          };
        }
      ]
    });

    for (const [id, worker] of Object.entries(functions)) {
      const bundle = await rollup({
        input: `file://./${file}`,
        output: { file: `file://bundle.js`, format: 'es' },
        plugins: [
          virtualFs({
            memoryOnly: false,
            files: {
              [`./${file}`]: `${external.join('\n')}\n const worker = ${worker.code}; export { worker };`
            }
          }),
          resolve(),
          commonjs(),
          esbuild({ target: 'es2022' })
        ]
      });

      const { output } = await bundle.generate({});

      // Update worker name to match `name-prefix-${hash}`
      // Save in CF KV or in Xata-in-Xata: [name-prefix-${hash}, bundle]

      console.log({
        id,
        code: worker.code,
        bundle: output.map((item) => (item as OutputChunk).code).join('\n')
      });

      this.#workers.set(id, { ...worker, bundle: output.map((item) => (item as OutputChunk).code).join('\n') });
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
