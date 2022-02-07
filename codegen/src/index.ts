#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { generate, Language } from './codegen';

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

const language = calculateLanguage(output);
generate(schema, output, language).catch(console.error);

function calculateLanguage(output: string): Language {
  if (output.endsWith('.ts')) return 'typescript';
  if (output.endsWith('.js')) return 'javascript';
  throw new Error(`Unsupported extension for the output file "${output}". Use either .ts or .js`);
}
