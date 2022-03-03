#!/usr/bin/env node
import { program } from 'commander';
import { join, relative } from 'path';
import ora from 'ora';
import { access } from 'fs/promises';
import { promisify } from 'util';
import { spawn } from 'child_process';
import inquirer from 'inquirer';

import { generate } from './codegen';
import { getExtensionFromLanguage } from './getExtensionFromLanguage';
import { checkIfCliInstalled } from './checkIfCliInstalled';
import { getCliInstallCommandsByOs } from './getInstallCommandByOs';

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

    const generateWithOutput = async (schema: any, out: any, lang: any) => {
      spinner.text = 'Found schema, generating...';

      await generate(schema, out, lang);

      spinner.succeed(
        `Your XataClient is generated at ./${relative(process.cwd(), `${out}${getExtensionFromLanguage(lang)}`)}.`
      );
    };

    try {
      await access(schema); // Make sure the schema file exists
      await generateWithOutput(schema, out, lang);
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
        return;
      }

      spinner.text = 'Checking for Xata CLI...';
      const hasCli = await checkIfCliInstalled();

      if (!hasCli) {
        spinner.warn('Xata CLI not installed');
        const { shouldDownloadCli } = await inquirer.prompt([
          {
            name: 'shouldDownloadCli',
            message: 'Would you like to install the Xata CLI on your computer?',
            type: 'confirm'
          }
        ]);

        if (shouldDownloadCli) {
          spinner.start('Installing Xata CLI...');
          const command = getCliInstallCommandsByOs(process.platform);
          spawn('sh', ['-c', command], {}).on('close', async () => {
            spinner.succeed('Xata CLI now available.');
            spinner.info('Delegating to Xata CLI...');
            spawn('xata', ['init'], { stdio: 'inherit' }).on('close', async () => {
              await generateWithOutput(defaultSchemaPath, defaultOutputFile, defaultLanguage);
            });
          });
        }
      }
    }
  });

program.parse();
