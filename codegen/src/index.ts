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

const defaultSchemaPath = join(process.cwd(), 'xata', 'schema.json');
const defaultOutputFile = join(process.cwd(), 'XataClient');
const defaultLanguage = 'ts';

program
  .name('xata-codegen')
  .description('The Xata SDK CLI is used to generate type-safe and predictable clients used to interact with Xata.')
  // There's nothing unsafe here, so disabling this rule in this case...
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  .version(require('../package.json').version);

program
  .command('generate')
  .description('Generate code from a given Xata schema.')
  .argument(
    '[schema file]',
    `A path to your local Xata schema. If you don't have this, run the pull command on this CLI first.`,
    defaultSchemaPath
  )
  .option('-o, --out <path>', 'A path to store your generated API client.', defaultOutputFile)
  .option(
    '-l, --lang [js|ts]',
    "An option to choose the type of code you'd like us to output: TypeScript (ts, preferred) or JavaScript (js)",
    defaultLanguage
  )
  .action(async (schema, { out, lang }) => {
    const spinner = ora();
    spinner.start('Checking schema...');

    try {
      await access(schema); // Make sure the schema file exists
      await generateWithOutput({ schema, out, lang, spinner });
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

        await useCli({ spinner });
        await generateWithOutput({
          schema: defaultSchemaPath,
          out: defaultOutputFile,
          lang: defaultLanguage,
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
          return;
        }
        spinner.fail(e.message as string);
        process.exit(1);
      }
    }
  });

program.parse();
