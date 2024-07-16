import { exec as execRaw } from 'child_process';
import * as util from 'util';
import { matrixToOclif, publishedPackagesContains } from './utils';
import { readProjectManifest } from '@pnpm/read-project-manifest';
const exec = util.promisify(execRaw);

async function main() {
  if (!process.env.MATRIX_OS) throw new Error('MATRIX_OS is not set');
  if (!process.env.PUBLISHED_PACKAGES) throw new Error('PUBLISHED_PACKAGES is not set');
  if (!process.env.COMMIT) throw new Error('COMMIT is not set');
  if (!process.env.CHANNEL) throw new Error('CHANNEL is not set');

  const PATH_TO_CLI = process.cwd() + '/cli';

  if (!publishedPackagesContains(process.env.PUBLISHED_PACKAGES, '@xata.io/cli')) return;

  const {
    manifest: { version }
  } = await readProjectManifest(PATH_TO_CLI);
  const platform = matrixToOclif(process.env.MATRIX_OS);
  exec(`pnpm oclif upload ${platform}`);
  exec(
    `pnpm oclif promote --${platform} --sha=${process.env.COMMIT} --indexes --version=${version} --channel=${process.env.CHANNEL}`
  );
}

main();
