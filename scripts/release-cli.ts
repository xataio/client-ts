import { createExportableManifest } from '@pnpm/exportable-manifest';
import { readProjectManifest } from '@pnpm/read-project-manifest';
import { writeProjectManifest } from '@pnpm/write-project-manifest';
import { exec as execRaw } from 'child_process';
import * as util from 'util';
const exec = util.promisify(execRaw);

const PATH_TO_CLI = process.cwd() + '/cli';

async function main() {
  const { manifest, fileName } = await readProjectManifest(PATH_TO_CLI);

  const workspaceProtocolPackageManifest = await createExportableManifest(PATH_TO_CLI, {
    ...manifest,
    dependencies: {
      ...manifest.dependencies,
      '@xata.io/client': 'next',
      '@xata.io/codegen': 'next',
      '@xata.io/importer': 'latest',
      '@xata.io/pgroll': 'latest'
    }
  });

  await writeProjectManifest(`${PATH_TO_CLI}/${fileName}`, workspaceProtocolPackageManifest);

  process.chdir(PATH_TO_CLI);

  await exec(`rm -rf ${PATH_TO_CLI}/npm-shrinkwrap.json`);
  const result = await exec(`touch ${PATH_TO_CLI}/npm-shrinkwrap.json`);
  if (result.stderr) {
    throw new Error(`Failed to make shrinkwrap: ${result.stderr}`);
  }
  console.log('Made shrinkwrap file', result.stdout);

  const pack = await exec(`pnpm oclif pack macos`);
  if (pack.stderr) {
    throw new Error(`Failed to pack: ${pack.stderr}`);
  }
  console.log('Packed CLI', pack.stdout);

  // TODO add built assets to release
  // or s3 bucket
}

main();
