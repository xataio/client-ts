import { readProjectManifest } from '@pnpm/read-project-manifest';
import { publishedPackagesContains } from './utils';

async function main() {
  const PATH_TO_CLI = process.cwd() + '/cli';

  if (!process.env.PUBLISHED_PACKAGES) throw new Error('PUBLISHED_PACKAGES is not set');
  if (!publishedPackagesContains(process.env.PUBLISHED_PACKAGES, '@xata.io/cli')) return;

  const { manifest } = await readProjectManifest(PATH_TO_CLI);
  console.log(manifest.version);
}

main();
