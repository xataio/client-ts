import fs from 'fs';
import path from 'path';

const pathName = path.join(process.cwd(), 'dist', 'cli.js');
const original = fs.readFileSync(pathName, 'utf8');

const contents = `#!/usr/bin/env node
`;

fs.writeFileSync(pathName, contents + original);
