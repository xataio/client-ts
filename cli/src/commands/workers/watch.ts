import { BaseClient } from '@xata.io/client';
import { EdgeRuntime } from 'edge-runtime';
import http from 'http';
import { AddressInfo } from 'net';
import fetch from 'node-fetch';
import url from 'url';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';
import { buildWatcher, compileWorkers, WorkerScript } from '../../workers.js';

export const WATCH_PORT = 64749;

export default class WorkersCompile extends BaseCommand {
  static description = 'Extract and compile xata workers';

  static flags = {};

  async run(): Promise<void> {
    const workers: Map<string, WorkerScript> = new Map();

    buildWatcher({
      action: async (path) => {
        const compiledWorkers = await compileWorkers(path);

        for (const [name, worker] of Object.entries(compiledWorkers)) {
          workers.set(name, worker);
        }
      }
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
        const workerFound = workers.get(val.name);
        if (!workerFound) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `Worker ${val.name} not found` }));
        }

        new EdgeRuntime({
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

        // TODO: Fix runtime.evaluate()
        const result = ''; /**await runtime.evaluate(
          workerFound.replace('export { xataWorker };', `xataWorker({ xata }, ...args);`)
        );**/

        // Return JSON response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ body: val, workerFound, result }));
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.toString() }));
      }
    });

    server.listen(WATCH_PORT, () => {
      const { port } = server.address() as AddressInfo;
      console.log(`Server listening on port ${port}`);
    });
  }
}

const bodySchema = z.any();
