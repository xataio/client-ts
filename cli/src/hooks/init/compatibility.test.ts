import { writeFile, readFile, stat } from 'fs/promises';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ONE_DAY, checkCompatibility, checkLatest, fetchInfo, getSdkVersion } from './compatibility.js';

vi.mock('node-fetch');
vi.mock('fs/promises');

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
  process.env.XATA_BRANCH = 'main';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const writeFileMock = writeFile as unknown as ReturnType<typeof vi.fn>;
const readFileMock = readFile as unknown as ReturnType<typeof vi.fn>;
const statMock = stat as unknown as ReturnType<typeof vi.fn>;

const latestFileObj = {
  latest: {
    cli: '1.0.0',
    sdk: '1.0.0'
  }
};
const compatibilityObj = {
  cli: {
    latest: '1.0.0',
    compatibility: [
      {
        range: '1.0.0',
        compatible: true
      }
    ]
  },
  sdk: {
    latest: '1.0.0',
    compatibility: [
      {
        range: '1.0.0',
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
          '@xata.io/client': '1.0.0'
        }
      : {
          someOtherPackage: '1.0.0'
        }
  };
};

fetchMock.mockReturnValue({
  ok: true,
  json: async () => compatibilityObj
});

describe('getSdkVersion', () => {
  test('returns version when @xata package', async () => {
    readFileMock.mockReturnValue(JSON.stringify(packageJsonObj(true)));
    expect(await getSdkVersion()).toEqual('1.0.0');
  });
  test('returns null when no @xata package', async () => {
    readFileMock.mockReturnValue(JSON.stringify(packageJsonObj(false)));
    expect(await getSdkVersion()).toEqual(null);
  });
});

describe('fetchInfo', () => {
  describe('refreshes', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(compatibilityObj));
      writeFileMock.mockReturnValue(undefined);
    });
    test('when no files exist', async () => {
      statMock.mockRejectedValue(undefined);
      await fetchInfo({
        compatibilityFile: './compatibility.json',
        compatibilityUri: '',
        dir: '',
        latestFile: './version.json'
      });
      expect(writeFileMock).toHaveBeenCalledTimes(2);
    });
    test('when file is stale', async () => {
      const yesterday = new Date().getDate() - ONE_DAY + 1000;
      statMock.mockReturnValue({ mtime: new Date(yesterday) });
      await fetchInfo({
        compatibilityFile: './compatibility.json',
        compatibilityUri: '',
        dir: '',
        latestFile: './version.json'
      });
      expect(writeFileMock).toHaveBeenCalledTimes(2);
    });
    test('when problem fetching, no file writes', async () => {
      fetchMock.mockReturnValue({
        ok: false
      });
      const yesterday = new Date().getDate() - ONE_DAY + 1000;
      statMock.mockReturnValue({ mtime: new Date(yesterday) });
      await fetchInfo({
        compatibilityFile: './compatibility.json',
        compatibilityUri: '',
        dir: '',
        latestFile: './version.json'
      });
      expect(writeFileMock).not.toHaveBeenCalled();
    });
  });
  describe('does not refresh', () => {
    test('if file is not stale', async () => {
      statMock.mockReturnValue({ mtime: new Date() });
      await fetchInfo({
        compatibilityFile: './compatibility.json',
        compatibilityUri: '',
        dir: '',
        latestFile: './version.json'
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(writeFileMock).not.toHaveBeenCalled();
    });
  });
});

describe('checks', () => {
  describe('latest', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(latestFileObj));
    });
    test('returns warn if newer package available', async () => {
      const cliResponse = await checkLatest({ pkg: 'cli', currentVersion: '0.0.1', file: './version.json' });
      expect(cliResponse.warn).toMatchInlineSnapshot(
        `"✨ A newer version of the Xata CLI is now available: 1.0.0. You are currently using version: 0.0.1"`
      );
      const sdkResponse = await checkLatest({ pkg: 'sdk', currentVersion: '0.0.2', file: './version.json' });
      expect(sdkResponse.warn).toMatchInlineSnapshot(
        `"✨ A newer version of the Xata SDK is now available: 1.0.0. You are currently using version: 0.0.2"`
      );
    });
    test('returns undefined if no newer package available', async () => {
      const cliResponse = await checkLatest({ pkg: 'cli', currentVersion: '1.0.0', file: './version.json' });
      expect(cliResponse.warn).toBeUndefined();
      const sdkResponse = await checkLatest({ pkg: 'sdk', currentVersion: '1.0.0', file: './version.json' });
      expect(sdkResponse.warn).toBeUndefined();
    });
  });
  describe('compatibility', () => {
    beforeEach(() => {
      readFileMock.mockReturnValue(JSON.stringify(compatibilityObj));
    });
    test('returns error if not compatible', async () => {
      const cliResponse = await checkCompatibility({
        pkg: 'cli',
        file: './compatibility.json',
        currentVersion: '0.0.1'
      });
      expect(cliResponse.error).toMatchInlineSnapshot(
        `"Incompatible version of CLI: 0.0.1. Please upgrade to a version that satisfies: 1.0.0."`
      );
      const sdkResponse = await checkCompatibility({
        pkg: 'cli',
        file: './compatibility.json',
        currentVersion: '0.0.2'
      });
      expect(sdkResponse.error).toMatchInlineSnapshot(
        `"Incompatible version of CLI: 0.0.2. Please upgrade to a version that satisfies: 1.0.0."`
      );
    });
    test('returns undefined if compatible', async () => {
      const cliResponse = await checkCompatibility({
        pkg: 'cli',
        file: './compatibility.json',
        currentVersion: '1.0.0'
      });
      expect(cliResponse.error).toBeUndefined();
      const sdkResponse = await checkCompatibility({
        pkg: 'sdk',
        file: './compatibility.json',
        currentVersion: '1.0.0'
      });
      expect(sdkResponse.error).toBeUndefined();
    });
  });
});
