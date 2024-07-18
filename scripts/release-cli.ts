import { createExportableManifest } from '@pnpm/exportable-manifest';
import { readProjectManifest } from '@pnpm/read-project-manifest';
import { writeProjectManifest } from '@pnpm/write-project-manifest';
import { execFile, exec as execRaw } from 'child_process';
import { Octokit } from '@octokit/core';
import fs from 'fs';
import * as util from 'util';
import { matrixToOclif, platformDistributions } from './utils';
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
  // if (!process.env.PUBLISHED_PACKAGES) throw new Error('PUBLISHED_PACKAGES is not set');
  if (!process.env.COMMIT_SHA) throw new Error('COMMIT_SHA is not set');
  // if (!publishedPackagesContains(process.env.PUBLISHED_PACKAGES, '@xata.io/cli')) return;

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

  const {
    manifest: { version }
  } = await readProjectManifest(PATH_TO_CLI);

  if (!version) throw new Error('Missing package version.');

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

  // Tarballs
  await exec(`pnpm oclif pack tarballs --targets=${platformDistributions(operatingSystem)}`);
  //Packages
  await exec(`pnpm oclif pack ${operatingSystem}`);
  if (operatingSystem === 'deb') {
    await installDebCert();
  }
  // Upload Tarballs
  await uploadS3(operatingSystem);
  // Upload packages
  await uploadS3(operatingSystem, { pkg: true });
  await promoteS3(operatingSystem, version);

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
    const platform = 'win';
    // Tarballs
    await exec(`pnpm oclif pack tarballs --targets=${platformDistributions(platform)}`);
    //Packages
    await exec(`pnpm oclif pack ${platform}`);
    // Upload Tarballs
    await uploadS3(platform);
    // Upload packages
    await uploadS3(platform, { pkg: true });
    await promoteS3(platform, version);
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

// # This will sign files after `oclif pack deb`, this script should be ran from the `dist/deb` folder
const installDebCert = async () => {
  await exec(
    `echo "$DEBIAN_GPG_KEY_PRIVATE" | base64 -d 2> /dev/null | gpg --import --batch --passphrase "$DEBIAN_GPG_KEY_PASS" 2> /dev/null`
  );
  await exec(
    `gpg --digest-algo SHA512 --clearsign --pinentry-mode loopback --passphrase "$DEBIAN_GPG_KEY_PASS" -u $DEBIAN_GPG_KEY_ID -o InRelease Release 2> /dev/null`
  );
  await exec(
    `gpg --digest-algo SHA512 -abs --pinentry-mode loopback --passphrase "$DEBIAN_GPG_KEY_PASS" -u $DEBIAN_GPG_KEY_ID -o Release`
  );
  await exec(`echo "Signed debian packages successfully"`);
  await exec(`echo "sha256 sums:"`);
  await exec(`sha256sum *Release*`);
  await exec(`
  mkdir -p ./dist/deb/release.key
  `);
  await exec(`echo "$DEBIAN_GPG_KEY_PUBLIC" | base64 --decode > ./dist/deb/release.key`);
};
