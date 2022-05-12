import { execSync } from 'child_process';
import crypto from 'crypto';

export function getAppName(target: string) {
  const sha = execSync('git rev-parse HEAD').toString().trim().slice(0, 7);
  const unique = crypto.randomBytes(2).toString('hex');
  return `test-${target}-${sha}-${unique}`;
}

export async function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
