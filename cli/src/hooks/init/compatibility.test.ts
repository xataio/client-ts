import { writeFile, readFile, stat } from 'fs/promises';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ONE_DAY, checkCompatibility, checkLatest, fetchInfo, getSdkVersion } from './compatibility.js';

vi.mock('node-fetch');
vi.mock('fs/promises');

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const writeFileMock = writeFile as unknown as ReturnType<typeof vi.fn>;
const readFileMock = readFile as unknown as ReturnType<typeof vi.fn>;
const statMock = stat as unknown as ReturnType<typeof vi.fn>;

const currentCli = '0.0.1';
const currentSdk = '0.0.2';
const latestCli = '1.0.0';
const latestSdk = '1.0.0';

const cliUpdateAvailable = `"✨ A newer version of the Xata CLI is now available: ${latestCli}. You are currently using version: ${currentCli}"`;
const sdkUpdateAvailable = `"✨ A newer version of the Xata SDK is now available: ${latestSdk}. You are currently using version: ${currentSdk}"`;

const cliError = `"Incompatible version of CLI: ${currentCli}. Please upgrade to a version that satisfies: ${latestCli}."`;
const sdkError = `"Incompatible version of SDK: ${currentSdk}. Please upgrade to a version that satisfies: ${latestSdk}."`;

const compatibilityFile = './compatibility.json';

const compatibilityObj = {
  cli: {
    latest: latestCli,
    compatibility: [
      {
        range: latestCli,
        compatible: true
      }
    ]
  },
  sdk: {
    latest: latestSdk,
    compatibility: [
      {
        range: latestSdk,
        compatible: true
      }
    ]
  }
};

const packageJsonObj = (withPackage: boolean) => {
  return {
    name: 'client-ts',
    dependencies: withPackage
      ? {
          '@xata.io/client': currentSdk
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
    expect(await getSdkVersion()).toEqual(currentSdk);
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
  const defaultParams = { tag: compatibilityObj };
  describe('latest', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(compatibilityObj));
    });
    test('returns warn if newer package available', async () => {
      const cliResponse = await checkLatest({ ...defaultParams, pkg: 'cli', currentVersion: currentCli });
      expect(cliResponse.warn).toMatchInlineSnapshot(cliUpdateAvailable);
      const sdkResponse = await checkLatest({ ...defaultParams, pkg: 'sdk', currentVersion: currentSdk });
      expect(sdkResponse.warn).toMatchInlineSnapshot(sdkUpdateAvailable);
    });
    test('returns undefined if no newer package available', async () => {
      const cliResponse = await checkLatest({ ...defaultParams, pkg: 'cli', currentVersion: latestSdk });
      expect(cliResponse.warn).toBeUndefined();
      const sdkResponse = await checkLatest({ ...defaultParams, pkg: 'sdk', currentVersion: latestSdk });
      expect(sdkResponse.warn).toBeUndefined();
    });
  });
  describe('compatibility', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(compatibilityObj));
    });
    test('returns error if not compatible', async () => {
      const cliResponse = await checkCompatibility({
        ...defaultParams,
        pkg: 'cli',
        currentVersion: currentCli
      });
      expect(cliResponse.error).toMatchInlineSnapshot(cliError);
      const sdkResponse = await checkCompatibility({
        ...defaultParams,
        pkg: 'sdk',
        currentVersion: currentSdk
      });
      expect(sdkResponse.error).toMatchInlineSnapshot(sdkError);
    });
    test('returns undefined if compatible', async () => {
      const cliResponse = await checkCompatibility({
        ...defaultParams,
        pkg: 'cli',
        currentVersion: latestCli
      });
      expect(cliResponse.error).toBeUndefined();
      const sdkResponse = await checkCompatibility({
        ...defaultParams,
        pkg: 'sdk',
        currentVersion: latestSdk
      });
      expect(sdkResponse.error).toBeUndefined();
    });
  });
});
