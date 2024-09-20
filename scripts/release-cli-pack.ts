import { createExportableManifest } from '@pnpm/exportable-manifest';
import { readProjectManifest } from '@pnpm/read-project-manifest';
import { writeProjectManifest } from '@pnpm/write-project-manifest';
import { execFile, exec as execRaw } from 'child_process';
import * as util from 'util';
import { matrixToOclif, platformDistributions, publishedPackagesContains } from './utils';
const exec = util.promisify(execRaw);

const PATH_TO_CLI = process.cwd() + '/packages/cli';
const PATH_TO_CLIENT = process.cwd() + '/packages/client';
const PATH_TO_CODEGEN = process.cwd() + '/packages/codegen';
const PATH_TO_IMPORTER = process.cwd() + '/packages/importer';
const PATH_TO_PGROLL = process.cwd() + '/packages/pgroll';

async function main() {
  if (!process.env.MATRIX_OS) throw new Error('MATRIX_OS is not set');
  if (!process.env.PUBLISHED_PACKAGES) throw new Error('PUBLISHED_PACKAGES is not set');

  if (!publishedPackagesContains(process.env.PUBLISHED_PACKAGES, '@xata.io/cli')) return;

  const operatingSystem = matrixToOclif(process.env.OS_OVERRIDE ?? process.env.MATRIX_OS);

  // Assume changeset version has been called and all the
  // versions in package jsons are up to date
  const { manifest, fileName } = await readProjectManifest(PATH_TO_CLI);
  const {
    manifest: { version: clientVersion }
  } = await readProjectManifest(PATH_TO_CLIENT);
  const {
    manifest: { version: codegenVersion }
  } = await readProjectManifest(PATH_TO_CODEGEN);
  const {
    manifest: { version: importerVersion }
  } = await readProjectManifest(PATH_TO_IMPORTER);
  const {
    manifest: { version: pgrollVersion }
  } = await readProjectManifest(PATH_TO_PGROLL);

  if (!clientVersion || !codegenVersion || !importerVersion || !pgrollVersion)
    throw new Error('Missing package versions.');

  if (!manifest.version) throw new Error('Missing package version.');

  const workspaceProtocolPackageManifest = await createExportableManifest(
    PATH_TO_CLI,
    {
      ...manifest,
      dependencies: {
        ...manifest.dependencies,
        '@xata.io/client': clientVersion,
        '@xata.io/codegen': codegenVersion,
        '@xata.io/importer': importerVersion,
        '@xata.io/pgroll': pgrollVersion
      }
    },
    {
      catalogs: {}
    }
  );

  await writeProjectManifest(`${PATH_TO_CLI}/${fileName}`, workspaceProtocolPackageManifest);

  process.chdir(PATH_TO_CLI);

  // Oclif pack expects a npm-shrinkwrap.json file and errors if it is not present.
  execFile('rm', ['-rf', `${PATH_TO_CLI}/npm-shrinkwrap.json`]);
  execFile('touch', [`${PATH_TO_CLI}/npm-shrinkwrap.json`]);

  // Clean up any old /dist directories if there are some
  for (const subdir of ['macos', 'deb', 'win32']) {
    await exec(`rm -rf ${PATH_TO_CLI}/dist/${subdir}`);
  }

  // Tarballs
  await exec(`pnpm oclif pack tarballs --targets=${platformDistributions(operatingSystem)}`);
  // Installers
  await exec(`pnpm oclif pack ${operatingSystem}`);
}

main();
