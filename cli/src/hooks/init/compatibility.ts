import { Hook } from '@oclif/core';
import { readFile, stat, writeFile } from 'fs/promises';
import semver from 'semver';
import { mkdir } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export type Packages = 'cli' | 'sdk';
export type VersionResponse = {
  [key in Packages]: {
    compatibility: { range: string; compatible: boolean; error?: string }[];
  };
};
export type LatestResponse = { latest: string };

const hook: Hook<'init'> = async function (_options) {
  const dir = path.join(process.cwd(), '.xata', 'version');
  const latestFile = `${dir}/version.json`;
  const compatibilityFile = `${dir}/compatibility.json`;

  const checkWarning = async () => {
    // Latest version check
    const tag: LatestResponse = JSON.parse(await readFile(latestFile, 'utf-8'));
    const updateAvailable = semver.lt(this.config.version, tag.latest);
    if (updateAvailable)
      this.log(
        `✨ A newer version of the Xata CLI is now available: ${tag.latest}. You are currently using version: ${this.config.version}`
      );

    // Compatibility check
    const compatibility: VersionResponse = JSON.parse(await readFile(compatibilityFile, 'utf-8'));
    const compatibleRange = compatibility.cli.compatibility
      .filter((v) => v.compatible)
      .map((v) => v.range)
      .join('||');
    const semverCompatible = semver.satisfies(this.config.version, compatibleRange);
    if (!semverCompatible)
      this.error(`Incompatible version of CLI. Please upgrade to a version that satisfies: ${compatibleRange}.`);
  };

  const refreshNeeded = async () => {
    try {
      // Latest time of one of the files should be enough
      const statResult = await stat(latestFile);
      const lastModified = new Date(statResult.mtime);
      // Last param is the number of days - we fetch new package info if the file is older than 1 day
      const staleAt = new Date(lastModified.valueOf() + 1000 * 60 * 60 * 24 * 1);
      return new Date() > staleAt;
    } catch (_e) {
      return true;
    }
  };

  const fetchInfo = async () => {
    try {
      mkdir(dir, { recursive: true }, () => {});
      const latestVersionResponse = await fetch('https://registry.npmjs.org/@xata.io%2fcli');
      const latestBody: any = await latestVersionResponse.json();
      const latest = latestBody['dist-tags'].latest;
      await writeFile(latestFile, JSON.stringify({ latest }, null, 2));
      const latestCompatibilityResponse = await fetch(
        'https://raw.githubusercontent.com/xataio/client-ts/main/compatibility.json'
      );
      const body: any = latestCompatibilityResponse.body;
      await writeFile(compatibilityFile, body);
    } catch (_e) {
      // Do nothing
    }
  };

  if (await refreshNeeded()) await fetchInfo();
  await checkWarning();
};

export default hook;
