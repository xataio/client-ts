import { exec, execSync } from 'child_process';
import fetch from 'node-fetch';
import path from 'path';
import { getAppName, isObject } from '../shared';

async function main() {
  const accountApiToken = process.env.VERCEL_API_TOKEN;
  if (!accountApiToken) throw new Error('VERCEL_API_TOKEN is not set');

  const appName = getAppName('vercel-next');
  const projectDir = path.join(__dirname, 'app');

  // Create Nextjs app
  execSync(`npx create-next-app app --ts --use-npm`);

  // Install npm dependencies
  execSync('npm install @xata.io/client', { cwd: projectDir });

  // Copy route
  execSync('cp ../test.ts pages/api/test.ts', { cwd: projectDir });

  // Install npm dependencies
  execSync('npm install', { cwd: projectDir });

  // Build the app
  execSync('npm run build', { cwd: projectDir });

  // Create Vercel project
  const createResponse = await fetch('https://api.vercel.com/v8/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountApiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      framework: 'nextjs',
      name: appName
    })
  });

  const { id: projectId, accountId } = await createResponse.json();

  // Add environment variables
  await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountApiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'XATA_API_KEY',
      value: process.env.XATA_API_KEY,
      type: 'encrypted',
      target: ['production']
    })
  });

  await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountApiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'XATA_WORKSPACE',
      value: process.env.XATA_WORKSPACE,
      type: 'encrypted',
      target: ['production']
    })
  });

  // Deploy the app
  execSync(`npx vercel deploy --prod --token ${accountApiToken}`, {
    cwd: projectDir,
    env: { ...process.env, VERCEL_ORG_ID: accountId, VERCEL_PROJECT_ID: projectId }
  });

  // GET /v6/deployments
  const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}`, {
    headers: {
      Authorization: `Bearer ${accountApiToken}`
    }
  });

  const { deployments } = await deploymentsResponse.json();
  const deploymentUrl = deployments[0].url;

  const response = await fetch(`${deploymentUrl}/api/test`);
  const body = await response.json();

  // Delete Vercel project
  execSync(`npx vercel remove ${appName} --token ${accountApiToken}`, {
    cwd: projectDir,
    env: { ...process.env, VERCEL_ORG_ID: accountId, VERCEL_PROJECT_ID: projectId }
  });

  if (
    isObject(body) &&
    Array.isArray(body.users) &&
    Array.isArray(body.teams) &&
    body.users.length > 0 &&
    body.teams.length > 0
  ) {
    console.log('Successfully fetched data from CF');
  } else {
    throw new Error('Failed to fetch data from CF');
  }
}

main();
