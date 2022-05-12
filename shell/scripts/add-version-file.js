import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.join(__dirname, '../package.json');
const pkgContents = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgContents);

const contents = `export const SHELL_VERSION = '${pkg.version}';`;
const versionPath = path.join(__dirname, '../src/version.ts');
fs.writeFileSync(versionPath, contents);
