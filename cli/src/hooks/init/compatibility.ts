import { Hook } from '@oclif/core';
import { readFile, stat, writeFile } from 'fs/promises';
import semver from 'semver';
import { mkdir } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export type Packages = 'cli' | 'sdk';
export type Compatibility = {
  [key in Packages]: {
    latest: string;
    compatibility: { range: string; compatible: boolean; error?: string }[];
  };
};
export type Latest = { latest: { [key in Packages]: string } };
export type PackageJson = { dependencies: Record<string, string> };

const hook: Hook<'init'> = async function (_options) {
  const ONE_DAY = 1000 * 60 * 60 * 24 * 1;
  const dir = path.join(process.cwd(), '.xata', 'version');
  const latestFile = `${dir}/version.json`;
  const compatibilityFile = `${dir}/compatibility.json`;
  const compatibilityUri = 'https://raw.githubusercontent.com/xataio/client-ts/main/compatibility.json';

  const displayWarning = async () => {
    await check('cli', this.config.version);
    const sdkVersion = await getSdkVersion();
    sdkVersion && (await check('sdk', sdkVersion));
  };

  const check = async (pkg: 'cli' | 'sdk', currentVersion: string) => {
    // Latest version check
    const tag: Latest = JSON.parse(await readFile(latestFile, 'utf-8'));
    const updateAvailable = semver.lt(this.config.version, tag.latest[pkg]);
    if (updateAvailable)
      this.log(
        `✨ A newer version of the Xata ${pkg.toUpperCase()} is now available: ${
          tag.latest[pkg]
        }. You are currently using version: ${currentVersion}`
      );
    // Compatibility check
    const compatibility: Compatibility = JSON.parse(await readFile(compatibilityFile, 'utf-8'));
    const compatibleRange = compatibility[pkg].compatibility
      .filter((v) => v.compatible)
      .map((v) => v.range)
      .join('||');
    const semverCompatible = semver.satisfies(currentVersion, compatibleRange);
    if (!semverCompatible)
      this.error(
        `Incompatible version of ${pkg.toUpperCase()}: ${currentVersion}. Please upgrade to a version that satisfies: ${compatibleRange}.`
      );
  };

  const getSdkVersion = async (): Promise<null | string> => {
    const packageJson: PackageJson = JSON.parse(await readFile(`${path.join(process.cwd())}/package.json`, 'utf-8'));
    return packageJson && packageJson.dependencies && packageJson.dependencies['@xata.io/client']
      ? packageJson.dependencies['@xata.io/client']
      : null;
  };

  const fetchInfo = async () => {
    let shouldRefresh = true;
    try {
      // Latest time of one of the files should be enough
      const statResult = await stat(latestFile);
      const lastModified = new Date(statResult.mtime);
      // Last param is the number of days - we fetch new package info if the file is older than 1 day
      const staleAt = new Date(lastModified.valueOf() + ONE_DAY);
      shouldRefresh = new Date() > staleAt;
    } catch (_e) {
      // Do nothing
    }
    if (shouldRefresh) {
      try {
        mkdir(dir, { recursive: true }, () => {});
        const latestCompatibilityResponse = await fetch(compatibilityUri);
        const body = latestCompatibilityResponse.body;
        await writeFile(compatibilityFile, body as NodeJS.ReadStream);
        const compatibility: Compatibility = JSON.parse(await readFile(compatibilityFile, 'utf-8'));
        await writeFile(
          latestFile,
          JSON.stringify({ latest: { cli: compatibility.cli.latest, sdk: compatibility.sdk.latest } }, null, 2)
        );
      } catch (_e) {
        // Do nothing
      }
    }
  };

  await fetchInfo();
  await displayWarning();
};

export default hook;
