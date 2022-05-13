import { createApp } from '@remix-run/dev';
import { execSync } from 'child_process';
import path from 'path';
import { getAppName } from './shared';

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');

  const accountDomain = process.env.CLOUDFLARE_ACCOUNT_DOMAIN;
  if (!accountDomain) throw new Error('CLOUDFLARE_ACCOUNT_DOMAIN is not set');

  const accountEmail = process.env.CLOUDFLARE_ACCOUNT_EMAIL;
  if (!accountEmail) throw new Error('CLOUDFLARE_ACCOUNT_EMAIL is not set');

  const accountApiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountApiToken) throw new Error('CLOUDFLARE_API_TOKEN is not set');

  const appName = getAppName('cf-pages');
  const projectDir = path.join(__dirname, 'apps', 'cf-pages', 'remix');

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

  // Build the app
  execSync('npm run build', { cwd: projectDir });

  // Publish the app to CF
  execSync(`npx wrangler publish public`, { cwd: projectDir });
}

main();
