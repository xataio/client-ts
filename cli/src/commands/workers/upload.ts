import fetch from 'node-fetch';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';
import { getProfile } from '../../credentials.js';
import { buildWatcher, compileWorkers, waitForWatcher, WorkerScript, workerScriptSchema } from '../../workers.js';

const UPLOAD_ENDPOINT = 'http://localhost:3000/api/workers';

export default class WorkersCompile extends BaseCommand {
  static description = 'Compile and upload xata workers';

  static flags = {};

  async run(): Promise<void> {
    const profile = await getProfile();
    if (!profile) this.error('No profile found');

    const workspace = await this.getWorkspace({ allowCreate: true });
    const database = await this.getDatabase(workspace, { allowCreate: true });

    // TODO: Ask which local environment variables to include
    // TODO: Read and parse local environment variables to include as secrets
    const environment = {};

    const workers: Map<string, WorkerScript> = new Map();

    const watcher = buildWatcher({
      action: async (path) => {
        const compiledWorkers = await compileWorkers(path);

        for (const [name, worker] of Object.entries(compiledWorkers)) {
          if (workers.has(name)) {
            this.error(`Worker ${name} already exists. Worker names must be unique.`);
          }

          workers.set(name, worker);
        }
      }
    });

    await waitForWatcher(watcher);

    const body: Body = {
      workspace,
      connection: {
        // TODO: Add support for multiple hosts
        databaseUrl: `https://${workspace}.xata.sh/db/${database}`,
        // TODO: Database scoped service API Key (backend generated maybe)
        apiKey: profile.apiKey
      },
      environment,
      scripts: Array.from(workers.values())
    };

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${profile.apiKey}` },
      body: JSON.stringify(body)
    });

    const { id: worker, createdAt: compileTime, publicKey } = responseSchema.parse(await response.json());

    // TODO: Update codegen file and save
    console.log({ worker, workspace, compileTime, publicKey });
  }
}

const bodySchema = z.object({
  workspace: z.string(),
  connection: z.object({
    databaseUrl: z.string(),
    apiKey: z.string()
  }),
  environment: z.record(z.string().min(1)),
  scripts: z.array(workerScriptSchema)
});

type Body = z.infer<typeof bodySchema>;

const responseSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  publicKey: z.string()
});
