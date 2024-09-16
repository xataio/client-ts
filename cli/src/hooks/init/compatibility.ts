import { Hook } from '@oclif/core';
import { readFile, stat, writeFile, mkdir } from 'fs/promises';
import semver from 'semver';
import path from 'path';
import fetch from 'node-fetch';

export const ONE_DAY = 1000 * 60 * 60 * 24 * 1;

export type Package = '@xata.io/cli' | '@xata.io/client';
export type Compatibility = Record<Package, { latest: string; compatibility: { range: string }[] }>;
export type PackageJson = { dependencies: Record<string, string> };

export const check = async ({ pkg, version, compat }: { pkg: Package; version: string; compat: Compatibility }) => {
  const currentVersion = semver.coerce(version)?.version as string;
  const updateAvailable = semver.lt(currentVersion, compat[pkg].latest);
  const compatibleRange = compat[pkg].compatibility.map((v) => v.range).join('||');
  const semverCompatible = semver.satisfies(currentVersion, compatibleRange);

  // Preview deployment or 0.0.0-next.version
  if (semver.prerelease(version)) return { warn: null, error: null };

  return {
    warn: updateAvailable
      ? `✨ A newer version of ${pkg} is now available: ${compat[pkg].latest}. You are currently using version: ${currentVersion}`
      : null,
    error: !semverCompatible
      ? `Incompatible version of ${pkg}: ${currentVersion}. Please upgrade to a version that satisfies: ${compatibleRange}.`
      : null
  };
};

export const getSdkVersion = async (): Promise<null | string> => {
  const packageJson: PackageJson = JSON.parse(await readFile(`${path.join(process.cwd())}/package.json`, 'utf-8'));
  return packageJson?.dependencies?.['@xata.io/client'] ? packageJson.dependencies['@xata.io/client'] : null;
};

export const fetchInfo = async ({ url, file }: { url: string; file: string }) => {
  let shouldRefresh = true;

  try {
    // Latest time of one of the files should be enough
    const statResult = await stat(file);
    const lastModified = new Date(statResult.mtime);
    // Last param is the number of days - we fetch new package info if the file is older than 1 day
    const staleAt = new Date(lastModified.valueOf() + ONE_DAY);
    shouldRefresh = new Date() > staleAt;
  } catch (error) {
    // Do nothing
  }

  if (shouldRefresh) {
    try {
      const latestCompatibilityResponse = await fetch(url);
      if (!latestCompatibilityResponse.ok) return;
      const body = await latestCompatibilityResponse.json();
      if (!(body as Compatibility)['@xata.io/cli']) return;

      try {
        await writeFile(file, JSON.stringify(body));
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, JSON.stringify(body));
        }
      }
    } catch (error) {
      // Do nothing
    }
  }
};

const hook: Hook<'init'> = async function (_options) {
  const dir = path.join(process.cwd(), '.xata', 'version');
  const compatibilityFile = `${dir}/compatibility.json`;
  const compatibilityUri = 'https://raw.githubusercontent.com/xataio/client-ts/main/compatibility.json';

  const displayWarning = async () => {
    const compat: Compatibility = JSON.parse(await readFile(compatibilityFile, 'utf-8'));

    const checks = [
      { pkg: '@xata.io/cli', version: this.config.version },
      { pkg: '@xata.io/client', version: await getSdkVersion() }
    ] as const;

    for (const { pkg, version } of checks) {
      if (!version) continue;

      const { warn, error } = await check({ pkg, version, compat });
      if (warn) this.log(warn);
      if (error) this.error(error);
    }
  };

  await fetchInfo({ file: compatibilityFile, url: compatibilityUri });
  await displayWarning();
};

export default hook;
