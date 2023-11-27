// @ts-check 
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Run "npx changeset version" to update the versions in the monorepo
execSync('npx changeset version', { stdio: 'inherit' });

const compatibilityPath = path.join(process.cwd(), 'compatibility.json');
const compatibilityData = fs.readFileSync(compatibilityPath, 'utf8');
const compatibility = JSON.parse(compatibilityData);

const packages = ['packages/client/package.json', 'cli/package.json'];
for (const packageJson of packages) {
  const contents = fs.readFileSync(path.join(process.cwd(), packageJson), 'utf8');
  const { name, version } = JSON.parse(contents);
  compatibility[name].latest = version;
}

fs.writeFileSync(compatibilityPath, JSON.stringify(compatibility, null, 2));
