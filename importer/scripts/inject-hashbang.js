import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathName = path.join(__dirname, '../dist/cli.js');
const original = fs.readFileSync(pathName, 'utf8');

const contents = `#!/usr/bin/env node
`;

fs.writeFileSync(pathName, contents + original);
