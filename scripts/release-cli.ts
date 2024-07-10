import { readProjectManifest } from '@pnpm/read-project-manifest';
import { execFile, exec as execRaw } from 'child_process';
import { Octokit } from '@octokit/core';
import fs from 'fs';
import * as util from 'util';
const exec = util.promisify(execRaw);

const base = {
  owner: 'xataio',
  repo: 'client-ts',
  headers: {
    'X-GitHub-Api-Version': '2022-11-28'
  }
};

const matrixToOclif = (os: string) => {
  switch (os) {
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

  const PATH_TO_CLI = process.cwd() + '/cli';
  const { manifest } = await readProjectManifest(PATH_TO_CLI);

  // Oclif pack expects a npm-shrinkwrap.json file and errors if it is not present.
  execFile('rm', ['-rf', `${PATH_TO_CLI}/npm-shrinkwrap.json`]);

  process.chdir(PATH_TO_CLI);

  await exec(`pnpm ls --prod --json >> npm-shrinkwrap.json`);

  // Build tarball with pnpm. Oclif uses npm which fails
  await exec(`pnpm pack`);

  await exec(`pnpm oclif pack ${operatingSystem} -t xata.io-cli-${manifest.version}.tgz`);

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
