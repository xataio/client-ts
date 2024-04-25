import { createExportableManifest } from '@pnpm/exportable-manifest';
import { readProjectManifest } from '@pnpm/read-project-manifest';
import { writeProjectManifest } from '@pnpm/write-project-manifest';
import { execFile, exec as execRaw } from 'child_process';
import { Octokit } from '@octokit/core';
import fs from 'fs';
import * as util from 'util';
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
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');

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

  // Assume changeset version has been called and all the
  // versions in package jsons are up to date

  const workspaceProtocolPackageManifest = await createExportableManifest(PATH_TO_CLI, {
    ...manifest,
    dependencies: {
      ...manifest.dependencies,
      '@xata.io/client': clientVersion ?? 'latest',
      '@xata.io/codegen': codegenVersion ?? 'latest',
      '@xata.io/importer': importerVersion ?? 'latest',
      '@xata.io/pgroll': pgrollVersion ?? 'latest'
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
  console.log('Successfully packed CLI', pack.stdout);

  // const octokit = new Octokit({
  //   auth: process.env.GITHUB_TOKEN
  // });

  // const tag = encodeURIComponent(`@xata.io/cli@${manifest.version}`);

  // const release = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
  //   ...base,
  //   tag
  // });

  // if (!release.data) throw new Error('Release not found');

  // windows installer is saved in "win32" folder in cli/dist
  const pathToAsset = `${PATH_TO_CLI}/dist/${operatingSystem === 'win' ? 'win32' : operatingSystem}`;

  const files = fs.readdirSync(pathToAsset);

  for (const file of files) {
    console.log('file in directory', file);
    const data = fs.readFileSync(pathToAsset + `/${file}`);
    console.log('data...', data);
    // const upload = await octokit.request('POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}', {
    //   ...base,
    //   name: file,
    //   label: file,
    //   release_id: release.data.id,
    //   data: data,
    //   baseUrl: 'https://uploads.github.com'
    // });
    // console.log('Finished uploading asset', upload.status);
  }
}

main();
