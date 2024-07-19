import { readProjectManifest } from '@pnpm/read-project-manifest';
import { exec as execRaw } from 'child_process';
import * as util from 'util';
import { matrixToOclif, platformDistributions } from './utils';
const exec = util.promisify(execRaw);

async function main() {
  if (!process.env.MATRIX_OS) throw new Error('MATRIX_OS is not set');
  if (!process.env.COMMIT_SHA) throw new Error('COMMIT_SHA is not set');

  const operatingSystem = matrixToOclif(process.env.OS_OVERRIDE ?? process.env.MATRIX_OS);

  const PATH_TO_CLI = process.cwd() + '/cli';

  const {
    manifest: { version }
  } = await readProjectManifest(PATH_TO_CLI);

  if (!version) throw new Error('Missing package version.');

  process.chdir(PATH_TO_CLI);

  // Upload tarballs
  await uploadS3(operatingSystem);
  // Upload installers
  await uploadS3(operatingSystem, { pkg: true });
  // Promote to stable
  await promoteS3(operatingSystem, version);
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
