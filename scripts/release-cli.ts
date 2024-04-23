import { createExportableManifest } from '@pnpm/exportable-manifest';
import { readProjectManifest } from '@pnpm/read-project-manifest';
import { writeProjectManifest } from '@pnpm/write-project-manifest';
import { execFile, execFileSync, exec as execRaw } from 'child_process';
import * as util from 'util';
const exec = util.promisify(execRaw);

const PATH_TO_CLI = process.cwd() + '/cli';

const matrixToOclif = (os: string) => {
  switch (os) {
    case 'windows-latest':
      return 'win';
    case 'macos-latest':
      return 'macos';
    case 'ubuntu-latest':
      return 'deb';
    default:
      throw new Error('Unsupported OS');
  }
};

async function main() {
  if (!process.env.MATRIX_OS) throw new Error('MATRIX_OS is not set');

  const operatingSystem = matrixToOclif(process.env.MATRIX_OS);

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

  execFile('rm', ['-rf', `${PATH_TO_CLI}/npm-shrinkwrap.json`]);
  execFile('touch', [`${PATH_TO_CLI}/npm-shrinkwrap.json`]);

  const pack = await exec(`pnpm oclif pack ${operatingSystem}`);
  if (pack.stderr) {
    throw new Error(`Failed to pack: ${pack.stderr}`);
  }
  console.log('Packed CLI', pack.stdout);
}

main();
