import { createApp } from '@remix-run/dev';
import { execSync } from 'child_process';
import https from 'https';
import fetch from 'cross-fetch';
import path from 'path';
import { getAppName, isObject } from '../shared';

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');

  const accountDomain = process.env.CLOUDFLARE_ACCOUNT_DOMAIN;
  if (!accountDomain) throw new Error('CLOUDFLARE_ACCOUNT_DOMAIN is not set');

  const accountApiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountApiToken) throw new Error('CLOUDFLARE_API_TOKEN is not set');

  const appName = getAppName('cf-pages');
  const projectDir = path.join(__dirname, 'remix');

  // Create Remix app
  await createApp({
    appTemplate: 'cloudflare-pages',
    installDeps: false,
    useTypeScript: true,
    projectDir,
    packageManager: 'npm'
  });

  // Install npm dependencies
  execSync('npm install', { cwd: projectDir });

  // Install client
  execSync(`npm install @xata.io/client@${process.env.VERSION_TAG}`, { cwd: projectDir });

  // Copy route
  execSync('cp ../test.ts app/routes/test.ts', { cwd: projectDir });

  // Build the app
  execSync('npm run build', { cwd: projectDir });

  // Create CF Pages project
  execSync(`npx wrangler pages project create ${appName} --production-branch main`, { cwd: projectDir });

  // Add environment variables
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${appName}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accountApiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_configs: {
        production: {
          env_vars: {
            XATA_API_KEY: { value: process.env.XATA_API_KEY },
            XATA_WORKSPACE: { value: process.env.XATA_WORKSPACE },
            NODE_VERSION: { value: 'v16.7.0' }
          }
        }
      }
    })
  });

  // Publish the app to CF
  execSync(`npx wrangler pages publish . --project-name ${appName} --branch main`, { cwd: projectDir });

  // Wait for deployment to complete
  const deploymentUrl = await checkDeploymentStatus(accountId, appName, accountApiToken);
  const url = await checkUrls([`https://${appName}.pages.dev`, deploymentUrl]);

  const response = await fetch(`${url}/test`, {
    // @ts-ignore
    agent: new https.Agent({
      // SSL Certificate can take some time to load
      rejectUnauthorized: false
    })
  });

  const body = await response.json();

  // Delete the app from CF
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${appName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accountApiToken}` }
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

async function checkDeploymentStatus(accountId: string, appName: string, apiToken: string, retry = 0): Promise<string> {
  if (retry > 20) throw new Error('Deployment failed');
  console.log(`Checking deployment status, retry ${retry + 1}`);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${appName}/deployments`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );

  if (response.status >= 200 && response.status < 400) {
    const data = (await response.json()) as any;
    const deployment = data.result[0];
    const latest = deployment.latest_stage;
    if (latest.name === 'deploy' && latest.status === 'success') {
      console.log('Deployment successful');
      return deployment.url;
    } else {
      console.error(`Deployment not complete; latest stage: ${latest.name}/${latest.status}`);
      await timeout(Math.min(1000 * Math.pow(2, retry), 60000));
      return checkDeploymentStatus(accountId, appName, apiToken, retry + 1);
    }
  } else {
    await timeout(Math.min(1000 * Math.pow(2, retry), 60000));
    return checkDeploymentStatus(accountId, appName, apiToken, retry + 1);
  }
}

async function checkUrls(urls: string[], retry = 0): Promise<string> {
  if (retry > 20) throw new Error('URL check failed');

  for (const url of urls) {
    console.log(`Checking ${url}, retry ${retry + 1}`);
    try {
      const response = await fetch(url, {
        // @ts-ignore
        agent: new https.Agent({
          // SSL Certificate can take some time to load
          rejectUnauthorized: false
        })
      });
      if (response.status >= 200 && response.status < 400) return url;
    } catch (error) {
      console.warn(`Failed to fetch ${url}`);
    }
  }

  await timeout(Math.min(1000 * Math.pow(2, retry), 60000));
  return checkUrls(urls, retry + 1);
}

async function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
