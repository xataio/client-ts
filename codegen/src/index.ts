#!/usr/bin/env node
import { program } from 'commander';
import { join } from 'path';
import ora from 'ora';
import { access } from 'fs/promises';
import inquirer from 'inquirer';
import chalk from 'chalk';

import { checkIfCliInstalled } from './checkIfCliInstalled';
import { getCli } from './getCli';
import { useCli } from './useCli';
import { generateWithOutput } from './generateWithOutput';
import { handleXataCliRejection } from './handleXataCliRejection';
import { cliPath } from './cliPath';

const defaultXataDirectory = join(process.cwd(), 'xata');
const defaultOutputFile = join(process.cwd(), 'XataClient');

program
  .name('xata-codegen')
  .description('The Xata SDK CLI is used to generate type-safe and predictable clients used to interact with Xata.');

program
  .command('generate')
  .description('Generate code from a given Xata schema.')
  .argument(
    '[xata directory]',
    `A path to your local Xata directory. If you don't have this, run the pull or \`init\` command on this CLI first.`,
    defaultXataDirectory
  )
  .option('-o, --out <path>', 'A path to store your generated API client.', defaultOutputFile)
  .action(async (xataDirectory, { out, lang }) => {
    const spinner = ora();
    const schema = join(xataDirectory, 'schema.json');
    spinner.start('Checking schema...');

    try {
      await access(schema); // Make sure the schema file exists
      await generateWithOutput({ xataDirectory, out, spinner });
    } catch (e: any) {
      if (!e.message.includes('ENOENT')) {
        spinner.fail(e.message);
        return;
      }

      spinner.warn('No local Xata schema found.');
      const { shouldUseCli } = await inquirer.prompt([
        { name: 'shouldUseCli', message: 'Would you like to use the Xata CLI and clone a database?', type: 'confirm' }
      ]);

      if (!shouldUseCli) {
        handleXataCliRejection(spinner);
        return;
      }

      spinner.text = 'Checking for Xata CLI...';
      const hasCli = await checkIfCliInstalled();

      try {
        if (!hasCli) {
          await getCli({ spinner });
        }

        await useCli({ command: hasCli ? 'xata' : cliPath, spinner });
        await generateWithOutput({
          xataDirectory,
          out: defaultOutputFile,
          spinner
        });
      } catch (e: any) {
        if (e.message.includes('ENOTFOUND') || e.message.includes('ENOENT')) {
          spinner.fail(
            `We tried to download the Xata CLI to clone your database locally, but failed because of internet connectivity issues. 

To try to clone your database locally yourself, visit ${chalk.blueBright(
              'https://docs.xata.io/cli/getting-started'
            )}, and then rerun the code generator. We apologize for the inconvenience. 
            
If you'd like to open an issue, please do so at ${chalk.blueBright('https://github.com/xataio/client-ts')}.
`
          );
          process.exit(1);
        }
        spinner.fail(e.message as string);
        process.exit(1);
      }
    }
  });

program.parse();
