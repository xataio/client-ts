import { BaseClient } from '@xata.io/client';
import chokidar from 'chokidar';
import { EdgeRuntime } from 'edge-runtime';
import http from 'http';
import { AddressInfo } from 'net';
import fetch from 'node-fetch';
import url from 'url';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';
import { compileWorkers } from '../../workers.js';

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
    const compiledWorkers = await compileWorkers(file);

    for (const [name, worker] of Object.entries(compiledWorkers)) {
      this.#workers.set(name, worker.modules[0].code);
    }
  }
}

const bodySchema = z.any();
