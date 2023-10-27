import { Hook } from '@oclif/core';
import { readFile, stat, writeFile, mkdir } from 'fs/promises';
import semver from 'semver';
import path from 'path';
import fetch from 'node-fetch';

export const ONE_DAY = 1000 * 60 * 60 * 24 * 1;

export type Packages = 'cli' | 'sdk';
export type Compatibility = {
  [key in Packages]: {
    latest: string;
    compatibility: { range: string }[];
  };
};
export type PackageJson = { dependencies: Record<string, string> };

export const check = async (params: {
  pkg: 'cli' | 'sdk';
  currentVersion: string;
  compatibilityObj: Compatibility;
}) => {
  const { pkg, currentVersion, compatibilityObj } = params;
  const updateAvailable = semver.lt(currentVersion, compatibilityObj[pkg].latest);

  const compatibleRange = compatibilityObj[pkg].compatibility.map((v) => v.range).join('||');
  const semverCompatible = semver.satisfies(currentVersion, compatibleRange);

  return {
    warn: updateAvailable
      ? `✨ A newer version of the Xata ${pkg.toUpperCase()} is now available: ${
          compatibilityObj[pkg].latest
        }. You are currently using version: ${currentVersion}`
      : null,
    error: !semverCompatible
      ? `Incompatible version of ${pkg.toUpperCase()}: ${currentVersion}. Please upgrade to a version that satisfies: ${compatibleRange}.`
      : null
  };
};

export const getSdkVersion = async (): Promise<null | string> => {
  const packageJson: PackageJson = JSON.parse(await readFile(`${path.join(process.cwd())}/package.json`, 'utf-8'));
  return packageJson && packageJson.dependencies && packageJson.dependencies['@xata.io/client']
    ? packageJson.dependencies['@xata.io/client']
    : null;
};

export const fetchInfo = async (params: { compatibilityUri: string; compatibilityFile: string }) => {
  const { compatibilityUri, compatibilityFile } = params;
  let shouldRefresh = true;
  try {
    // Latest time of one of the files should be enough
    const statResult = await stat(compatibilityFile);
    const lastModified = new Date(statResult.mtime);
    // Last param is the number of days - we fetch new package info if the file is older than 1 day
    const staleAt = new Date(lastModified.valueOf() + ONE_DAY);
    shouldRefresh = new Date() > staleAt;
  } catch (_e) {
    // Do nothing
  }
  if (shouldRefresh) {
    try {
      const latestCompatibilityResponse = await fetch(compatibilityUri);
      if (!latestCompatibilityResponse.ok) return;
      const body = await latestCompatibilityResponse.json();
      if (!(body as Compatibility).cli) return;
      try {
        await writeFile(compatibilityFile, JSON.stringify(body));
      } catch (e) {
        if ((e as any).code === 'ENOENT') {
          await mkdir(path.dirname(compatibilityFile), { recursive: true });
          await writeFile(compatibilityFile, JSON.stringify(body));
        }
      }
    } catch (_e) {
      // Do nothing
    }
  }
};

const hook: Hook<'init'> = async function (_options) {
  const dir = path.join(process.cwd(), '.xata', 'version');
  const compatibilityFile = `${dir}/compatibility.json`;
  const compatibilityUri = 'https://raw.githubusercontent.com/xataio/client-ts/main/compatibility.json';

  const displayWarning = async () => {
    const compatibilityObj: Compatibility = JSON.parse(await readFile(compatibilityFile, 'utf-8'));
    const defaultParams = { compatibilityObj };

    const cliPkg = 'cli';
    const cliVersion = this.config.version;
    const { warn, error } = await check({ ...defaultParams, pkg: cliPkg, currentVersion: cliVersion });
    if (warn) this.log(warn);
    if (error) this.error(error);

    const sdkVersion = await getSdkVersion();
    if (sdkVersion) {
      const sdkPkg = 'sdk';
      const { warn, error } = await check({ ...defaultParams, pkg: sdkPkg, currentVersion: cliVersion });
      if (warn) this.log(warn);
      if (error) this.error(error);
    }
  };

  await fetchInfo({ compatibilityFile, compatibilityUri });
  await displayWarning();
};

export default hook;
