import { exec as execRaw } from 'child_process';
import * as util from 'util';
import { matrixToOclif, platformDistributions, publishedPackagesContains } from './utils';
import { readProjectManifest } from '@pnpm/read-project-manifest';
const exec = util.promisify(execRaw);

async function main() {
  if (!process.env.MATRIX_OS) throw new Error('MATRIX_OS is not set');
  if (!process.env.PUBLISHED_PACKAGES) throw new Error('PUBLISHED_PACKAGES is not set');
  if (!process.env.COMMIT_SHA) throw new Error('COMMIT_SHA is not set');
  if (!process.env.CHANNEL) throw new Error('CHANNEL is not set');

  const PATH_TO_CLI = process.cwd() + '/cli';

  if (!publishedPackagesContains(process.env.PUBLISHED_PACKAGES, '@xata.io/cli')) return;

  const {
    manifest: { version }
  } = await readProjectManifest(PATH_TO_CLI);

  if (!version) throw new Error('Missing package version.');

  const platform = matrixToOclif(process.env.MATRIX_OS);

  process.chdir(PATH_TO_CLI);

  await uploadS3(platform);

  await promoteS3(version, platformDistributions(platform));

  // Upload and promote windows since it is packed on linux
  if (platform === 'deb') {
    await uploadS3('win');
    await promoteS3(version, platformDistributions('win'));
  }
}

const uploadS3 = async (platform: 'macos' | 'deb' | 'win') => {
  const uploadRes = await exec(`pnpm oclif upload ${platform}`);
  console.log('Uploaded release', uploadRes.stdout);
};

const promoteS3 = async (version: string, distribution: string) => {
  const promoteRes = await exec(
    `pnpm oclif promote --sha=${process.env.COMMIT_SHA} --indexes --version=${version} --channel=${process.env.CHANNEL} --targets=${distribution}`
  );
  console.log('Promoted release', promoteRes.stdout);
};

main();
