import fetch from 'cross-fetch';
import { z } from 'zod';
import { BaseCommand } from '../../base.js';
import { getProfile } from '../../credentials.js';

export default class WorkersCompile extends BaseCommand {
  static description = 'Compile and upload xata workers';

  static flags = {};

  async run(): Promise<void> {
    const profile = await getProfile();
    if (!profile) this.error('No profile found');

    // @ts-ignore FIXME
    const body: Body = {};

    // Call API Endpoint
    const response = await fetch('http://localhost:3000/api/workers/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${profile.apiKey}` },
      body: JSON.stringify(body)
    });

    const { id: worker, workspace, createdAt: compileTime, publicKey } = responseSchema.parse(await response.json());

    // Update codegen file and save
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
  scripts: z.array(
    z.object({
      name: z.string(),
      main: z.string(),
      modules: z.array(
        z.object({
          name: z.string(),
          content: z.string()
        })
      )
    })
  )
});

type Body = z.infer<typeof bodySchema>;

const responseSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  publicKey: z.string()
});
