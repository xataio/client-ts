#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { generate } from './codegen';

const { argv } = yargs(hideBin(process.argv))
  .option('schema', {
    type: 'string',
    alias: 's',
    description: 'The schema file',
    default: './xata/schema.json'
  })
  .option('output', {
    type: 'string',
    alias: 'o',
    description: 'The output file',
    default: 'xata.ts'
  });

const { schema, output } = argv as { schema: string; output: string };

generate(schema, output).catch(console.error);
