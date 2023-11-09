import { exec } from 'child_process';

async function main() {
  if (!process.env.CANARY_VERSION) throw new Error('CANARY_VERSION is not set');
  if (!process.env.XATA_DATABASE_URL) throw new Error('XATA_DATABASE_URL is not set');
  if (!process.env.XATA_BRANCH) throw new Error('XATA_BRANCH is not set');

  console.log(`Running canary test for ${process.env.CANARY_VERSION}`);

  const cli = `@xata.io/cli@${process.env.CANARY_VERSION}`;

  const download = new Promise((resolve) => {
    const command = exec(`npx -y ${cli}`);
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
    const command = exec(`npx ${cli} init -y --db ${process.env.XATA_DATABASE_URL} --force`);
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
    const command = exec(`npx ${cli} pull ${process.env.XATA_BRANCH} -y --db ${process.env.XATA_DATABASE_URL}`);
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
