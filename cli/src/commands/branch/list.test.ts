import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import BranchList from './list.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('branches list', () => {
  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });

    const config = await Config.load();
    const command = new BranchList([], config);
    command.projectConfig = {
      databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test'
    };

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.eu-west-1.xata.sh/dbs/test');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });

  test.each([[false], [true]])('returns the data with enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        branches: [
          {
            name: 'main',
            createdAt: '2020-01-01T00:00:00.000Z'
          }
        ],
        mapping: []
      })
    });

    const config = await Config.load();
    const command = new BranchList([], config);
    command.projectConfig = {
      databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test'
    };
    command.locale = 'en-US';
    command.timeZone = 'UTC';

    expect(BranchList.enableJsonFlag).toBe(true);
    vi.spyOn(command, 'jsonEnabled').mockReturnValue(json);

    const printTable = vi.spyOn(command, 'printTable');

    const result = await command.run();

    if (json) {
      expect(result[0].name).toEqual('main');
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.eu-west-1.xata.sh/dbs/test');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(printTable).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(printTable.mock.calls[0][0]).toEqual(['Name', 'Created at']);
    }
  });
});
