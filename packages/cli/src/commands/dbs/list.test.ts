import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import DatabasesList from './list.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('databases list', () => {
  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });

    const config = await Config.load();
    const list = new DatabasesList(['--workspace', 'test-1234'], config);

    await expect(list.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });

  test.each([[false], [true]])('returns the data with enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        databases: [{ name: 'test', createdAt: '2020-01-01T00:00:00.000Z' }]
      })
    });

    const config = await Config.load();
    const list = new DatabasesList(['--workspace', 'test-1234'], config);
    list.locale = 'en-US';
    list.timeZone = 'UTC';

    expect(DatabasesList.enableJsonFlag).toBe(true);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

    const printTable = vi.spyOn(list, 'printTable');

    const result = await list.run();

    if (json) {
      expect(result).toEqual([
        {
          createdAt: '2020-01-01T00:00:00.000Z',
          name: 'test'
        }
      ]);
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(printTable).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(printTable.mock.calls[0][1][0][0]).toBe('test');
      expect(printTable.mock.calls[0][2]).toEqual(['l', 'l', 'r']);
    }
  });
});
