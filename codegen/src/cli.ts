import { program } from 'commander';
import dotenv from 'dotenv';
import { join } from 'path';
import { generateFromAPI } from './api.js';
import { exitWithError } from './errors.js';
import { generateFromLocalFiles } from './local.js';
import { spinner } from './spinner.js';
import { CODEGEN_VERSION } from './version.js';
import { getDatabaseURL, getAPIKey } from '@xata.io/client';

const defaultXataDirectory = join(process.cwd(), 'xata');
const defaultOutputFile = join(process.cwd(), 'src', 'xata.ts');

program
  .name('xata-codegen')
  .description('The Xata SDK CLI is used to generate type-safe and predictable clients used to interact with Xata.')
  .version(CODEGEN_VERSION)
  .argument(
    '[xata directory]',
    `A path to your local Xata directory. If you don't have one, run 'xata init' or 'xata pull' first with the xata CLI https://github.com/xataio/cli`,
    defaultXataDirectory
  )
  .option('-o, --out <path>', 'A path to store your generated API client.', defaultOutputFile)
  .option('-e, --env <path>', 'Path to the .env file to load.', '.env')
  .action(async (xataDirectory, { out, env }) => {
    dotenv.config({ path: env });

    spinner?.start('Checking schema...');

    try {
      const databaseURL = getDatabaseURL();
      const apiKey = getAPIKey();
      if (databaseURL && apiKey) {
        await generateFromAPI(out, databaseURL, apiKey);
      } else {
        await generateFromLocalFiles(xataDirectory, out);
      }
    } catch (err) {
      exitWithError(err);
    }
  });

program.parse();
