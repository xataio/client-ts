import { Flags } from '@oclif/core';
import fetch from 'node-fetch';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';
import { buildWatcher, compileWorkers, waitForWatcher, WorkerScript, workerScriptSchema } from '../../workers.js';

const UPLOAD_ENDPOINT = 'http://localhost:3000/api/workers';

export default class Upload extends BaseCommand {
  static description = 'Compile and upload xata workers';

  static flags = {
    include: Flags.string({
      description: 'Include a glob pattern of files to compile'
    }),
    ignore: Flags.string({
      description: 'Exclude a glob pattern of files to compile'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Upload);

    const profile = await this.getProfile();
    if (!profile) this.error('No profile found');

    const { workspace, databaseURL } = await this.getParsedDatabaseURL();

    // TODO: Ask which local environment variables to include
    // TODO: Read and parse local environment variables to include as secrets
    const environment = {};

    // TODO: Load them from .xatarc too
    const { include, ignore } = flags;
    console.log(`Including: ${include}`);
    console.log(`Ignoring: ${ignore}`);

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
      },
      included: include?.split(','),
      ignored: ignore?.split(',')
    });

    await waitForWatcher(watcher);

    const body: Body = {
      workspace,
      connection: {
        databaseUrl: databaseURL,
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
