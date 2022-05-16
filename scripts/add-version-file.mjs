import fs from 'fs';
import path from 'path';

const pkgPath = path.join(process.cwd(), 'package.json');
const pkgContents = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgContents);

const contents = `export const VERSION = '${pkg.version}';`;
const versionPath = path.join(process.cwd(), 'src', 'version.ts');
fs.writeFileSync(versionPath, contents);
