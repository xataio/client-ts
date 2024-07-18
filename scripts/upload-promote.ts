import { createExportableManifest } from '@pnpm/exportable-manifest';
import { readProjectManifest } from '@pnpm/read-project-manifest';
import { writeProjectManifest } from '@pnpm/write-project-manifest';
import { execFile, execFileSync, exec as execRaw } from 'child_process';
import { Octokit } from '@octokit/core';
import fs from 'fs';
import * as util from 'util';
import { matrixToOclif, platformDistributions } from './utils';
const exec = util.promisify(execRaw);

async function main() {
  if (!process.env.MATRIX_OS) throw new Error('MATRIX_OS is not set');
  if (!process.env.COMMIT_SHA) throw new Error('COMMIT_SHA is not set');

  const operatingSystem = matrixToOclif(process.env.MATRIX_OS);

  const PATH_TO_CLI = process.cwd() + '/cli';

  const {
    manifest: { version }
  } = await readProjectManifest(PATH_TO_CLI);

  if (!version) throw new Error('Missing package version.');

  // Upload Tarballs
  await uploadS3(operatingSystem);
  // Upload packages
  await uploadS3(operatingSystem, { pkg: true });
  await promoteS3(operatingSystem, version);

  // Pack windows on linux
  if (operatingSystem === 'deb') {
    const platform = 'win';

    // Upload Tarballs
    await uploadS3(platform);
    // Upload packages
    await uploadS3(platform, { pkg: true });
    await promoteS3(platform, version);
  }
}
main();

const uploadS3 = async (platform: 'macos' | 'deb' | 'win', options?: { pkg: boolean }) => {
  const uploadRes = options?.pkg
    ? await exec(`pnpm oclif upload ${platform}`)
    : await exec(`pnpm oclif upload tarballs --targets=${platformDistributions(platform)}`);
  console.log('Uploaded release', uploadRes.stdout);
};

const promoteS3 = async (platform: 'macos' | 'deb' | 'win', version: string) => {
  const promoteRes = await exec(
    `pnpm oclif promote --${platform} --sha=${process.env.COMMIT_SHA?.slice(
      0,
      8
    )} --indexes --version=${version} --channel=stable --targets=${platformDistributions(platform)}`
  );
  console.log('Promoted release', promoteRes.stdout);
};
