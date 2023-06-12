import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import WorkspaceList from './list.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('workspaces list', () => {
  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });

    const config = await Config.load();
    const list = new WorkspaceList([], config);

    await expect(list.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });

  test.each([[false], [true]])('returns the data with enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        workspaces: [
          {
            name: 'test',
            id: 'test-1234',
            role: 'Maintainer'
          }
        ]
      })
    });

    const config = await Config.load();
    const list = new WorkspaceList([], config);

    expect(WorkspaceList.enableJsonFlag).toBe(true);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

    const printTable = vi.spyOn(list, 'printTable');

    const result = await list.run();

    if (json) {
      expect(result).toEqual([
        {
          id: 'test-1234',
          name: 'test',
          role: 'Maintainer'
        }
      ]);
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(printTable).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(printTable.mock.calls[0]).toEqual([['Name', 'Id', 'Role'], [['test', 'test-1234', 'Maintainer']]]);
    }
  });
});
