import { readFileSync, writeFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { generate, parseSchemaFile } from '../dist/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const databaseURL = 'https://test-r5vcv5.eu-west-1.xata.sh/db/test';
  const fileContents = readFileSync(join(__dirname, 'schema.json'), 'utf-8');
  const { data: schema } = parseSchemaFile(fileContents);

  // Test for existing code
  const typescriptContents = await readFile(join(__dirname, 'xata.ts'), 'utf-8').catch(() => undefined);

  const { typescript } = await generate({
    schema,
    databaseURL,
    language: 'typescript',
    existingCode: undoReplaceImport(typescriptContents)
  });
  const { javascript: mjs, types } = await generate({ schema, databaseURL, language: 'javascript' });
  const { javascript: cjs } = await generate({ schema, databaseURL, language: 'javascript', moduleType: 'cjs' });

  writeFileSync(join(__dirname, 'xata.ts'), replaceImport(typescript));
  writeFileSync(join(__dirname, 'xata.js'), replaceImport(mjs));
  writeFileSync(join(__dirname, 'xata.cjs'), replaceImport(cjs));
  writeFileSync(join(__dirname, 'types.d.ts'), replaceImport(types));
}

function replaceImport(source) {
  return source?.replaceAll('@xata.io/client', '../../client/src');
}

function undoReplaceImport(source) {
  return source?.replaceAll('../../client/src', '@xata.io/client');
}

main().catch(console.error);
