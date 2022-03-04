#!/usr/bin/env node
import { program } from 'commander';
import { join, relative } from 'path';
import ora from 'ora';
import { access } from 'fs/promises';

import { generate } from './codegen';
import { getExtensionFromLanguage } from './getExtensionFromLanguage';

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
    join(process.cwd(), 'xata', 'schema.json')
  )
  .option('-o, --out <path>', 'A path to store your generated API client.', join(process.cwd(), 'XataClient'))
  .option(
    '-l, --lang [js|ts]',
    "An option to choose the type of code you'd like us to output: TypeScript (ts, preferred) or JavaScript (js)",
    'typescript'
  )
  .action(async (schema, { out, lang }) => {
    const spinner = ora();
    spinner.start('Checking schema...');

    try {
      await access(schema); // Make sure the schema file exists
      spinner.text = 'Found schema, generating...';

      await generate(schema, out, lang);

      spinner.succeed(
        `Your XataClient is generated at ./${relative(process.cwd(), `${out}${getExtensionFromLanguage(lang)}`)}.`
      );
    } catch (e: any) {
      spinner.fail(e.message);
    }
  });

program.parse();
