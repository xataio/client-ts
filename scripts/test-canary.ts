import { exec } from 'child_process';

async function main() {
  if (!process.env.CANARY_VERSION) throw new Error('CANARY_VERSION is not set');
  if (!process.env.XATA_DATABASE_URL) throw new Error('XATA_DATABASE_URL is not set');
  if (!process.env.XATA_BRANCH) throw new Error('XATA_BRANCH is not set');

  console.log(`Running canary test for ${process.env.CANARY_VERSION}`);
  console.log(`Running canary test against ${process.env.XATA_DATABASE_URL}:${process.env.XATA_BRANCH}`);

  const cli = `@xata.io/cli@${process.env.CANARY_VERSION}`;

  const download = new Promise((resolve, reject) => {
    exec(`npx -y ${cli}`, async (error) => {
      if (error) {
        console.log('error is:', error);
        //or
        reject(error);
      }
      resolve('done');
    });
  });
  await download;

  const init = new Promise((resolve, reject) => {
    exec(`npx ${cli} init --db ${process.env.XATA_DATABASE_URL} --force`, async (error) => {
      if (error) {
        console.log('error is:', error);
        //or
        reject(error);
      }
      resolve('done');
    });
  });

  await init;

  const schemaPull = new Promise((resolve, reject) => {
    exec(`npx ${cli} pull ${process.env.XATA_BRANCH} --db ${process.env.XATA_DATABASE_URL}`, async (error) => {
      if (error) {
        console.log('error is:', error);
        //or
        reject(error);
      }
      resolve('done');
    });
  });

  await schemaPull;
  console.log(`Completed successfully`);
}

main();
