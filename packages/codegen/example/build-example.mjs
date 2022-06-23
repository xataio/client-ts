import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { generate, parseSchemaFile } from '../dist/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const databaseURL = 'https://test-r5vcv5.xata.sh/db/test';
  const schema = await parseSchemaFile(readFileSync(join(__dirname, 'schema.json'), 'utf-8'));

  const js = await generate({ schema, databaseURL, language: 'javascript' });
  const ts = await generate({ schema, databaseURL, language: 'typescript' });

  writeFileSync(join(__dirname, 'xata.ts'), replaceImport(ts.transpiled));
  writeFileSync(join(__dirname, 'xata.js'), replaceImport(js.transpiled));
  if (js.declarations) {
    writeFileSync(join(__dirname, 'types.d.ts'), replaceImport(js.declarations));
  }
}

function replaceImport(source) {
  return source.replace('@xata.io/client', '../../client/src');
}

main().catch(console.error);
