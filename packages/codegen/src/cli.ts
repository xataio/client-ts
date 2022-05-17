import { getAPIKey, getDatabaseURL } from '@xata.io/client';
import { program } from 'commander';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path, { dirname, join, relative } from 'path';
import { generateFromContext } from './api.js';
import { exitWithError } from './errors.js';
import { getLanguageFromExtension } from './generateWithOutput.js';
import { generateFromLocalFiles } from './local.js';
import { spinner } from './spinner.js';
import { VERSION } from './version.js';

const defaultXataDirectory = join(process.cwd(), 'xata');
const defaultOutputFile = join(process.cwd(), 'src', 'xata.ts');

program
  .name('xata-codegen')
  .description('The Xata SDK CLI is used to generate type-safe and predictable clients used to interact with Xata.')
  .version(VERSION)
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
        const outputFilePath = path.resolve(process.cwd(), out);
        const [extension] = outputFilePath.split('.').slice(-1);

        const language = getLanguageFromExtension(extension);

        const { transpiled, declarations } = await generateFromContext(language, { databaseURL, apiKey });
        await fs.writeFile(outputFilePath, transpiled);
        if (declarations) await fs.writeFile(`${dirname(outputFilePath)}/types.d.ts`, declarations);
      } else {
        await generateFromLocalFiles(xataDirectory, out);
      }

      spinner?.succeed(`Your XataClient is generated at ./${relative(process.cwd(), out)}`);
    } catch (err) {
      exitWithError(err);
    }
  });

program.parse();
