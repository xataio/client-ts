#!/usr/bin/env node
import { program } from 'commander';
import { join } from 'path';

import { generate } from './codegen';

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
  .action((schema, { out, lang }) => {
    generate(schema, out, lang).catch(console.error);
  });

program.parse();
