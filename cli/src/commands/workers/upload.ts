import { BaseCommand } from '../../base.js';
import { getProfile } from '../../credentials.js';
import fetch from 'cross-fetch';
import crypto from 'crypto';

export default class WorkersCompile extends BaseCommand {
  static description = 'Compile and upload xata workers';

  static flags = {};

  async run(): Promise<void> {
    const profile = await getProfile();
    if (!profile) this.error('No profile found');

    const response = await fetch('http://localhost:3000/api/workers/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${profile.apiKey}` }
    });

    const { publicKey, encrypted } = await response.json();

    const buf = crypto.publicDecrypt({ key: publicKey }, Buffer.from(encrypted));

    console.log(JSON.parse(buf.toString('utf8')));
  }
}
