import { getAPIKey } from '@xata.io/client';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import * as path from 'path';

export async function readAPIKey() {
  const apiKey = getAPIKey();
  if (apiKey) return apiKey;

  const keyPath = path.join(homedir(), '.config', 'xata', 'key');
  try {
    return (await readFile(keyPath, 'utf-8')).trim();
  } catch (err) {
    return null;
  }
}
