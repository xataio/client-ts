import { writeFile, readFile, stat } from 'fs/promises';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ONE_DAY, check, fetchInfo, getSdkVersion } from './compatibility.js';
import semver from 'semver';

vi.mock('node-fetch');
vi.mock('fs/promises');

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const writeFileMock = writeFile as unknown as ReturnType<typeof vi.fn>;
const readFileMock = readFile as unknown as ReturnType<typeof vi.fn>;
const statMock = stat as unknown as ReturnType<typeof vi.fn>;

const latestAvailableVersionCLI = '1.0.0';
const latestAvailableVersionSDK = '2.0.0';
const specificVersionCLI = '0.0.8';

const userVersionCLI = '~0.0.1';
const userVersionSDK = '^0.0.2';
const userVersionAlpha = `${latestAvailableVersionCLI}-alpha.v927d47c`;

const cliUpdateAvailable = `"✨ A newer version of the Xata CLI is now available: ${latestAvailableVersionCLI}. You are currently using version: ${semver.coerce(
  userVersionCLI
)}"`;
const sdkUpdateAvailable = `"✨ A newer version of the Xata SDK is now available: ${latestAvailableVersionSDK}. You are currently using version: ${semver.coerce(
  userVersionSDK
)}"`;

const cliError = `"Incompatible version of CLI: ${semver.coerce(
  userVersionCLI
)}. Please upgrade to a version that satisfies: >=${latestAvailableVersionCLI}||${specificVersionCLI}."`;
const sdkError = `"Incompatible version of SDK: ${semver.coerce(
  userVersionSDK
)}. Please upgrade to a version that satisfies: ${latestAvailableVersionSDK}."`;

const compatibilityFile = './compatibility.json';

const compatibilityObj = {
  cli: {
    latest: latestAvailableVersionCLI,
    compatibility: [
      {
        range: `>=${latestAvailableVersionCLI}`
      },
      {
        range: `${specificVersionCLI}`
      }
    ]
  },
  sdk: {
    latest: latestAvailableVersionSDK,
    compatibility: [
      {
        range: latestAvailableVersionSDK
      }
    ]
  }
};

const packageJsonObj = (withPackage: boolean) => {
  return {
    name: 'client-ts',
    dependencies: withPackage
      ? {
          '@xata.io/client': userVersionSDK
        }
      : {}
  };
};

fetchMock.mockReturnValue({
  ok: true,
  json: async () => compatibilityObj
});

describe('getSdkVersion', () => {
  test('returns version when @xata package', async () => {
    readFileMock.mockReturnValue(JSON.stringify(packageJsonObj(true)));
    expect(await getSdkVersion()).toEqual(userVersionSDK);
  });
  test('returns null when no @xata package', async () => {
    readFileMock.mockReturnValue(JSON.stringify(packageJsonObj(false)));
    expect(await getSdkVersion()).toEqual(null);
  });
});

describe('fetchInfo', () => {
  const fetchInfoParams = {
    compatibilityFile,
    compatibilityUri: ''
  };
  describe('refreshes', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(compatibilityObj));
      writeFileMock.mockReturnValue(undefined);
    });
    test('when no files exist', async () => {
      statMock.mockRejectedValue(undefined);
      await fetchInfo(fetchInfoParams);
      expect(writeFileMock).toHaveBeenCalledTimes(1);
    });
    test('when file is stale', async () => {
      const yesterday = new Date().getDate() - ONE_DAY + 1000;
      statMock.mockReturnValue({ mtime: new Date(yesterday) });
      await fetchInfo(fetchInfoParams);
      expect(writeFileMock).toHaveBeenCalledTimes(1);
    });
    test('when problem fetching, no file writes', async () => {
      fetchMock.mockReturnValue({
        ok: false
      });
      const yesterday = new Date().getDate() - ONE_DAY + 1000;
      statMock.mockReturnValue({ mtime: new Date(yesterday) });
      await fetchInfo(fetchInfoParams);
      expect(writeFileMock).not.toHaveBeenCalled();
    });
  });
  describe('does not refresh', () => {
    test('if file is not stale', async () => {
      statMock.mockReturnValue({ mtime: new Date() });
      await fetchInfo(fetchInfoParams);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(writeFileMock).not.toHaveBeenCalled();
    });
  });
});

describe('checks', () => {
  const defaultParams = { compatibilityObj };
  describe('latest', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(compatibilityObj));
    });
    test('returns warn if newer package available', async () => {
      const cliResponse = await check({ ...defaultParams, pkg: 'cli', currentVersion: userVersionCLI });
      expect(cliResponse.warn).toMatchInlineSnapshot(cliUpdateAvailable);
      const sdkResponse = await check({ ...defaultParams, pkg: 'sdk', currentVersion: userVersionSDK });
      expect(sdkResponse.warn).toMatchInlineSnapshot(sdkUpdateAvailable);
    });
    test('returns null if no newer package available', async () => {
      const cliResponse = await check({ ...defaultParams, pkg: 'cli', currentVersion: latestAvailableVersionCLI });
      expect(cliResponse.warn).toBeNull();
      const sdkResponse = await check({ ...defaultParams, pkg: 'sdk', currentVersion: latestAvailableVersionSDK });
      expect(sdkResponse.warn).toBeNull();
    });
  });
  describe('compatibility', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(compatibilityObj));
    });
    test('returns error if not compatible', async () => {
      const cliResponse = await check({
        ...defaultParams,
        pkg: 'cli',
        currentVersion: userVersionCLI
      });
      expect(cliResponse.error).toMatchInlineSnapshot(cliError);
      const sdkResponse = await check({
        ...defaultParams,
        pkg: 'sdk',
        currentVersion: userVersionSDK
      });
      expect(sdkResponse.error).toMatchInlineSnapshot(sdkError);
    });
    test('returns null if compatible', async () => {
      const cliResponse = await check({
        ...defaultParams,
        pkg: 'cli',
        currentVersion: latestAvailableVersionCLI
      });
      expect(cliResponse.error).toBeNull();
      const sdkResponse = await check({
        ...defaultParams,
        pkg: 'sdk',
        currentVersion: latestAvailableVersionSDK
      });
      expect(sdkResponse.error).toBeNull();
      // Alpha versions
      const cliResponseAlpha = await check({
        ...defaultParams,
        pkg: 'cli',
        currentVersion: userVersionAlpha
      });
      expect(cliResponseAlpha.error).toBeNull();
      expect(cliResponseAlpha.warn).toBeNull();
    });
  });
});
