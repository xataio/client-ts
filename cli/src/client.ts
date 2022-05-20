import { Command } from '@oclif/core';
import { getAPIKey, XataApiClient } from '@xata.io/client';
import { readFile } from 'fs/promises';
import fetch from 'node-fetch';
import { homedir } from 'os';
import * as path from 'path';

async function readAPIKey() {
  const apiKey = getAPIKey();
  if (apiKey) return apiKey;

  const keyPath = path.join(homedir(), '.config', 'xata', 'key');
  try {
    return (await readFile(keyPath, 'utf-8')).trim();
  } catch (err) {
    return null;
  }
}

export async function getXataClient(command: Command) {
  const apiKey = await readAPIKey();
  if (!apiKey) command.error('Could not instantiate Xata client. No API key found.'); // TODO: give suggested next steps
  return new XataApiClient({ apiKey, fetch });
}
