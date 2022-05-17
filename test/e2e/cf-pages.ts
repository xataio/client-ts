import { createApp } from '@remix-run/dev';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import path from 'path';
import { getAppName } from './shared';
import https from 'https';
import retry from 'retry';

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');

  const accountDomain = process.env.CLOUDFLARE_ACCOUNT_DOMAIN;
  if (!accountDomain) throw new Error('CLOUDFLARE_ACCOUNT_DOMAIN is not set');

  const accountApiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountApiToken) throw new Error('CLOUDFLARE_API_TOKEN is not set');

  const appName = getAppName('cf-pages');
  const projectDir = path.join(__dirname, 'apps', 'cf-pages', 'remix');
  const deploymentUrl = `https://${appName}.pages.dev`;

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

  // Copy route
  execSync('cp ../test.ts app/routes/test.ts', { cwd: projectDir });

  // Build the app
  execSync('npm run build', { cwd: projectDir });

  // Create CF Pages project
  execSync(`npx wrangler pages project create ${appName} --production-branch main`, { cwd: projectDir });

  // Publish the app to CF
  execSync(`npx wrangler pages publish . --project-name ${appName} --branch main`, { cwd: projectDir });

  // Force deployment
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${appName}/deployments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accountApiToken}` }
  });

  // Wait for deployment to complete
  await checkDeploymentStatus(accountId, appName, accountApiToken);
  await checkUrl(deploymentUrl);

  const response = await fetch(`${deploymentUrl}/test`, {
    agent: new https.Agent({
      // SSL Certificate takes a long time to load
      rejectUnauthorized: false
    })
  });
  const body = await response.json();

  console.log(body);

  // Delete the app from CF
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${appName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accountApiToken}` }
  });
}

main();

function checkDeploymentStatus(accountId: string, appName: string, apiToken: string) {
  const operation = retry.operation({ retries: 20 });

  return new Promise((resolve) => {
    operation.attempt(async (currentAttempt) => {
      console.log(`Checking deployment status; attempt ${currentAttempt}`);
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${appName}/deployments`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );

      if (response.status >= 200 && response.status < 400) {
        const data = await response.json();
        const deployment = data.result[0];
        const latest = deployment.latest_stage;
        if (latest.name === 'deploy' && latest.status === 'success') {
          resolve('Pages deployed successfully');
        } else {
          const message = `Deployment not complete; latest stage: ${latest.name}/${latest.status}`;
          console.error(message);
          operation.retry(new Error(message));
        }
      } else {
        const message = `URL responded with status ${response.status}`;
        console.error(message);
        operation.retry(new Error(message));
      }
    });
  });
}

export function checkUrl(url: string) {
  const operation = retry.operation({ retries: 10 });

  return new Promise((resolve, reject) => {
    operation.attempt(async () => {
      try {
        const response = await fetch(url);
        if (response.status >= 200 && response.status < 400) {
          resolve(`${url} responded with status ${response.status}`);
        } else {
          throw new Error(`${url} responded with status ${response.status}`);
        }
      } catch (error: any) {
        console.error(error);
        reject(operation.retry(error));
      }
    });
  });
}
