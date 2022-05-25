import { getAPIKey } from '@xata.io/client';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { homedir } from 'os';
import * as path from 'path';
import { dirname } from 'path';

const keyPath = path.join(homedir(), '.config', 'xata', 'key');

export async function readAPIKey() {
  const apiKey = getAPIKey();
  if (apiKey) return apiKey;
  return readAPIKeyFromFile();
}

export async function readAPIKeyFromFile() {
  try {
    return (await readFile(keyPath, 'utf-8')).trim();
  } catch (err) {
    return null;
  }
}

export async function writeAPIKey(apiKey: string) {
  const dir = dirname(keyPath);
  await mkdir(dir, { recursive: true });
  await writeFile(keyPath, apiKey, { mode: 0o600 });
}

export async function removeAPIKey() {
  return unlink(keyPath);
}
