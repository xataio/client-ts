import { exec } from 'child_process';

async function main() {
  if (!process.env.CANARY_VERSION) throw new Error('CANARY_VERSION is not set');
  if (!process.env.XATA_DATABASE_URL) throw new Error('XATA_DATABASE_URL is not set');
  if (!process.env.XATA_BRANCH) throw new Error('XATA_BRANCH is not set');
  if (!process.env.XATA_WORKSPACE) throw new Error('XATA_WORKSPACE is not set');

  console.log(`Running canary test for ${process.env.CANARY_VERSION}`);

  const cli = `@xata.io/cli@${process.env.CANARY_VERSION}`;

  const workspaceUrl = 'https://{workspaceId}.{region}.staging-xata.dev'
    .replace('{workspaceId}', process.env.XATA_WORKSPACE)
    .replace('{region}', 'eu-west-1');
  const databaseUrl = `${workspaceUrl}/db/${process.env.XATA_DATABASE_URL}`;

  const download = new Promise((resolve) => {
    const command = exec(`npx -y ${cli} init -h`);
    command.stdout?.on('data', (data) => {
      console.log(data);
      resolve('done');
    });
    command.stderr?.on('data', (data) => {
      console.log(data);
      throw new Error('Failed to download canary');
    });
  });
  await download;

  const init = new Promise((resolve) => {
    const command = exec(`npx ${cli} init -y --db ${databaseUrl} --force`);
    command.stdout?.on('data', (data) => {
      console.log(data);
      resolve('done');
    });
    command.stderr?.on('data', (data) => {
      console.log(data);
      throw new Error('Failed to init');
    });
  });
  await init;

  const schemaPull = new Promise((resolve) => {
    const command = exec(`npx ${cli} pull ${process.env.XATA_BRANCH} -y --db ${databaseUrl}`);
    command.stdout?.on('data', (data) => {
      console.log(data);
      resolve('done');
    });
    command.stderr?.on('data', (data) => {
      console.log(data);
      throw new Error('Failed to pull schema');
    });
  });
  await schemaPull;

  console.log(`Completed successfully`);
}

main();
