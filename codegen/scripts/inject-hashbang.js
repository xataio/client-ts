import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathName = path.join(__dirname, '../dist/index.js');
const original = fs.readFileSync(pathName, 'utf8');

const contents = `#!/bin/sh
':' //; exec /usr/bin/env node --es-module-specifier-resolution=node "$0" "$@"

`;

fs.writeFileSync(pathName, contents + original);
