import fs from 'fs';
import path from 'path';

//[{"name": "@xx/xx", "version": "1.2.0"}, {"name": "@xx/xy", "version": "0.8.9"}]
const packageNames = ["@xata.io/client", "@xata.io/cli"]
const packages = JSON.parse(process.env.PUBLISHED_PACKAGES).filter(pkg => packageNames.includes(pkg.name));

const compatibilityPath = path.join(process.cwd(), 'compatibility.json');
const compatibility = fs.readFileSync(compatibilityPath, 'utf8');

for (const pkg of packages) {
    const oldVersion = JSON.parse(compatibility)[name].latest
    const newVersion = pkg.version
    const name = pkg.name
    compatibility.replace(oldVersion, newVersion)
}

fs.writeFileSync(compatibilityPath, compatibility);
