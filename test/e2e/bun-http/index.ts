import { execSync } from 'child_process';
import fetch from 'cross-fetch';
import { isObject } from '../shared';

async function main() {
  execSync(`bun test.ts`, { cwd: __dirname });

  const response = await fetch('http://localhost:12345');
  const body = await response.json();

  if (
    isObject(body) &&
    Array.isArray(body.users) &&
    Array.isArray(body.teams) &&
    body.users.length > 0 &&
    body.teams.length > 0
  ) {
    console.log('Successfully fetched data from bun http server');
  } else {
    throw new Error('Failed to fetch data from bun http server');
  }
}

main();
