import { exec as execRaw } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import * as util from 'util';
const exec = util.promisify(execRaw);

async function main() {
  if (!process.env.CANARY_VERSION) throw new Error('CANARY_VERSION is not set');
  if (!process.env.XATA_WORKSPACE) throw new Error('XATA_WORKSPACE is not set');

  console.log(`Running canary test for ${process.env.CANARY_VERSION}`);

  const cli = `@xata.io/cli@${process.env.CANARY_VERSION}`;

  const databaseName = `canary_${randomUUID()}`;
  const region = process.env.XATA_REGION || 'us-east-1';
  const dir = path.join(__dirname, 'throwaway');
  const file = path.join(dir, 'test.ts');
  const schemaFile = path.join(dir, 'schema.json');

  const schemaContent = `{
      "tables": [
        {
          "name": "teams",
          "columns": [
            {
              "name": "name",
              "type": "string"
            }
          ]
        }
      ]
  }`;

  const fullyQualifiedEndpoint = `https://${process.env.XATA_WORKSPACE}.${region}.xata.sh/db/${databaseName}`;

  const makeDir = async () => {
    await exec(`rm -rf ${dir}`);
    const result = await exec(`mkdir ${dir}`);
    if (result.stderr) {
      throw new Error(`Failed to make dir: ${result.stderr}`);
    }
    console.log('Made dir', result.stdout);
  };

  const download = async (retry = 0) => {
    try {
      const result = await exec(`cd ${dir} && npm cache clean --force && npm install -g ${cli}`);
      console.log('Downloaded npm package', result.stdout);
      return result;
    } catch (e) {
      if (retry < 8) {
        const nextTry = retry + 1;
        console.log(`Could not download npm package, retrying... ${e}. Attempt: ${nextTry}`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * 10 * nextTry));
        await download(nextTry);
      } else {
        throw e;
      }
    }
  };

  const create = async () => {
    const result = await exec(
      `cd ${dir} && npx ${cli} dbs create ${databaseName} --workspace ${process.env.XATA_WORKSPACE} --region ${region}`
    );
    if (result.stderr.includes('Error:')) {
      throw new Error(`Failed to create database: ${result.stderr}`);
    }
    console.log('Created database', result.stdout);
  };

  const init = async () => {
    const result = await exec(`cd ${dir} && npx ${cli} init --db ${fullyQualifiedEndpoint} --codegen ${file} --force`);
    // Warnings go to stderr
    if (result.stderr.includes('Error:')) {
      throw new Error(`Failed to init: ${result.stderr}`);
    }
    console.log('Initialized database', result.stdout);
  };

  const schemaPull = async () => {
    const result = await exec(`npx ${cli} pull main --no-input --db ${fullyQualifiedEndpoint} -f`);
    if (result.stderr) {
      throw new Error(`Failed to pull schema: ${result.stderr}`);
    }
    console.log('Pulled schema', result.stdout);
  };

  const schemaPush = async () => {
    const result = await exec(`npx ${cli} push main --db ${fullyQualifiedEndpoint} -y`);
    if (result.stderr) {
      throw new Error(`Failed to push schema: ${result.stderr}`);
    }
    console.log('Pushed schema', result.stdout);
  };

  const schemaUpload = async () => {
    await exec(`echo '${schemaContent}' > ${schemaFile}`);
    const result = await exec(`npx ${cli} schema upload ${schemaFile} --db ${fullyQualifiedEndpoint} -b main -y`);
    if (result.stderr) {
      throw new Error(`Failed to upload schema: ${result.stderr}`);
    }
    console.log('Uploaded schema', result.stdout);
  };

  const createBranch = async () => {
    const result = await exec(`npx ${cli} branch create tester --db ${fullyQualifiedEndpoint}`);
    if (result.stderr) {
      throw new Error(`Failed to create branch: ${result.stderr}`);
    }
    console.log('Created branch', result.stdout);
  };

  const deleteBranch = async () => {
    const result = await exec(`npx ${cli} branch delete tester --db ${fullyQualifiedEndpoint} -f`);
    if (result.stderr) {
      throw new Error(`Failed to delete branch: ${result.stderr}`);
    }
    console.log('Deleted branch', result.stdout);
  };

  const deleteDatabase = async () => {
    const result = await exec(
      `cd ${dir} && npx ${cli} dbs delete ${databaseName} --no-input -f --workspace ${process.env.XATA_WORKSPACE}`
    );
    if (result.stderr) {
      throw new Error(`Failed to delete database: ${result.stderr}`);
    }
    console.log('Deleted database', result.stdout);
  };

  try {
    await makeDir();
    await download();
    await create();
    await init();
    await schemaPull();
    await schemaPush();
    await schemaUpload();
    await createBranch();
    await deleteBranch();
  } finally {
    await deleteDatabase();
  }
}

main();
