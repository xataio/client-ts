import { createExportableManifest } from '@pnpm/exportable-manifest';
import { readProjectManifest } from '@pnpm/read-project-manifest';
import { writeProjectManifest } from '@pnpm/write-project-manifest';
import { execFile, exec as execRaw } from 'child_process';
import { Octokit } from '@octokit/core';
import fs from 'fs';
import * as util from 'util';
import { matrixToOclif } from './utils';
const exec = util.promisify(execRaw);

const PATH_TO_CLI = process.cwd() + '/cli';
const PATH_TO_CLIENT = process.cwd() + '/packages/client';
const PATH_TO_CODEGEN = process.cwd() + '/packages/codegen';
const PATH_TO_IMPORTER = process.cwd() + '/packages/importer';
const PATH_TO_PGROLL = process.cwd() + '/packages/pgroll';

const base = {
  owner: 'xataio',
  repo: 'client-ts',
  headers: {
    'X-GitHub-Api-Version': '2022-11-28'
  }
};

async function main() {
  if (!process.env.MATRIX_OS) throw new Error('MATRIX_OS is not set');
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
  if (!process.env.PUBLISHED_PACKAGES) throw new Error('PUBLISHED_PACKAGES is not set');

  if (
    process.env.PUBLISHED_PACKAGES === '' ||
    !(JSON.parse(process.env.PUBLISHED_PACKAGES) as Array<{ name: string; version: string }>).find(
      (change) => change.name === '@xata.io/cli'
    )
  ) {
    console.log('No changes in cli. Skipping asset release.');
    return;
  }

  const operatingSystem = matrixToOclif(process.env.MATRIX_OS);

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

  // Assume changeset version has been called and all the
  // versions in package jsons are up to date

  const workspaceProtocolPackageManifest = await createExportableManifest(PATH_TO_CLI, {
    ...manifest,
    dependencies: {
      ...manifest.dependencies,
      '@xata.io/client': clientVersion,
      '@xata.io/codegen': codegenVersion,
      '@xata.io/importer': importerVersion,
      '@xata.io/pgroll': pgrollVersion
    }
  });

  await writeProjectManifest(`${PATH_TO_CLI}/${fileName}`, workspaceProtocolPackageManifest);

  process.chdir(PATH_TO_CLI);

  // Oclif pack expects a npm-shrinkwrap.json file and errors if it is not present.
  execFile('rm', ['-rf', `${PATH_TO_CLI}/npm-shrinkwrap.json`]);
  execFile('touch', [`${PATH_TO_CLI}/npm-shrinkwrap.json`]);

  await exec(`pnpm oclif pack ${operatingSystem}`);

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const tag = `@xata.io/cli@${manifest.version}`;

  const release = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
    ...base,
    tag
  });

  if (!release.data) throw new Error('Release not found');

  const pathToAsset = `${PATH_TO_CLI}/dist/${operatingSystem}`;
  // Debian pack results in redundant files. Only upload .deb files
  const files = fs
    .readdirSync(pathToAsset)
    .filter((file) => (operatingSystem === 'deb' ? file.endsWith('.deb') : true));
  for (const file of files) {
    await uploadFiles({ pathToFile: pathToAsset + `/${file}`, fileName: file, octokit, releaseId: release.data.id });
  }

  // Pack windows on linux
  if (operatingSystem === 'deb') {
    await exec(`pnpm oclif pack win`);
    // Windows packs files under "win32" directory
    const pathToAssetWindows = `${PATH_TO_CLI}/dist/win32`;
    const files = fs.readdirSync(pathToAssetWindows);
    for (const file of files) {
      await uploadFiles({
        pathToFile: pathToAssetWindows + `/${file}`,
        fileName: file,
        octokit,
        releaseId: release.data.id
      });
    }
  }
}

const uploadFiles = async ({
  pathToFile,
  fileName,
  octokit,
  releaseId
}: {
  pathToFile: string;
  fileName: string;
  octokit: Octokit;
  releaseId: number;
}) => {
  const data = fs.readFileSync(pathToFile);
  const upload = await octokit.request('POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}', {
    ...base,
    name: fileName,
    label: fileName,
    release_id: releaseId,
    data: data,
    baseUrl: 'https://uploads.github.com'
  });
  console.log('Finished uploading asset', upload.status);
};

main();
