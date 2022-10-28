import { Flags } from '@oclif/core';
import fetch from 'node-fetch';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';
import { buildWatcher, compileWorkers, workerScriptSchema } from '../../workers.js';

const UPLOAD_ENDPOINT = 'https://app.xata.io/api/workers';

export default class Upload extends BaseCommand {
  static description = 'Compile and upload xata workers';
  static hidden = true;

  static flags = {
    ...this.databaseURLFlag,
    include: Flags.string({
      description: 'Include a glob pattern of files to compile'
    }),
    ignore: Flags.string({
      description: 'Exclude a glob pattern of files to compile'
    })
  };

  async run(): Promise<void> {
    // TODO: Load them from .xatarc too
    const { flags } = await this.parse(Upload);

    const profile = await this.getProfile();
    if (!profile) this.error('No profile found');

    const { workspace, region, database, databaseURL } = await this.getParsedDatabaseURL(flags.db);

    // TODO: Ask which local environment variables to include
    // TODO: Read and parse local environment variables to include as secrets
    const environment = {};

    const { watcher } = buildWatcher({
      compile: (path) => compileWorkers(path),
      run: async (workers) => {
        this.log(`Uploading ${workers.length} workers`);

        const body: Body = {
          workspace,
          database,
          region,
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
          headers: { Authorization: `Bearer ${profile.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const json = await response.json();

        const { id } = responseSchema.parse(json);

        // TODO: Update codegen file and save
        this.info(`Worker: ${id}`);

        await watcher.close();

        return () => Promise.resolve();
      },
      included: flags.include?.split(','),
      ignored: flags.ignore?.split(',')
    });
  }
}

const bodySchema = z.object({
  workspace: z.string(),
  database: z.string(),
  region: z.string(),
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
  createdBy: z.string(),
  createdAt: z.string()
});
