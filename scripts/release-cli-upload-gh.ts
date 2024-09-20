import { readProjectManifest } from '@pnpm/read-project-manifest';
import { Octokit } from '@octokit/core';
import fs from 'fs';
import { matrixToOclif } from './utils';

const PATH_TO_CLI = process.cwd() + '/packages/cli';

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

  const operatingSystem = matrixToOclif(process.env.OS_OVERRIDE ?? process.env.MATRIX_OS);

  const {
    manifest: { version }
  } = await readProjectManifest(PATH_TO_CLI);

  if (!version) throw new Error('Missing package version.');

  process.chdir(PATH_TO_CLI);

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const tag = `@xata.io/cli@${version}`;

  const release = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
    ...base,
    tag
  });

  if (!release.data) throw new Error('Release not found');

  // Windows packs files under "win32" directory
  const pathToAssets =
    operatingSystem === 'win' ? `${PATH_TO_CLI}/dist/win32` : `${PATH_TO_CLI}/dist/${operatingSystem}`;
  // Debian pack results in redundant installer files. Only upload .deb files
  const files = fs
    .readdirSync(pathToAssets)
    .filter((file) => (operatingSystem === 'deb' ? file.endsWith('.deb') : true));
  for (const file of files) {
    await uploadFiles({ pathToFile: pathToAssets + `/${file}`, fileName: file, octokit, releaseId: release.data.id });
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
