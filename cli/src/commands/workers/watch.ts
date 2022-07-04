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
import { BaseCommand } from '../../base.js';

export default class WorkersCompile extends BaseCommand {
  static description = 'Extract and compile xata workers';

  static flags = {};

  async run(): Promise<void> {
    const watcher = chokidar.watch('./**/*.ts', {
      ignored: [/(^|[/\\])\../, 'dist/*', 'node_modules/*']
    });

    watcher
      .on('add', (path) => this.#compile(path))
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

        console.log(body);

        res.writeHead(200);
        res.end();
      } catch (err) {
        res.writeHead(500);
        res.end(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
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
                    const args = (path.parent as CallExpression).arguments;

                    const code = path.toString();
                    const id = crypto.createHash('sha1').update(code).digest('hex').substring(0, 7);

                    // TODO: Read old name, remove old hash, add new hash
                    functions[id] = { code, argsSize: args.length };
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
              [`./${file}`]: `${external.join('\n')}\nexport default ${worker.code};`
            }
          }),
          resolve(),
          commonjs(),
          esbuild()
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
