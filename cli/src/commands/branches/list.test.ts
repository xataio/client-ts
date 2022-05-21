import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import BranchesList from './list.js';

vi.mock('node-fetch');

clearEnvVariables();

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('branches list', () => {
  test('fails if no workspace id can be found', async () => {
    const config = await Config.load();
    const list = new BranchesList([], config as Config);

    await expect(list.run()).rejects.toThrow(
      'Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.'
    );
  });

  test('prints the results in a table when successful', async () => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        branches: [
          {
            name: 'main',
            createdAt: '2020-01-01T00:00:00.000Z'
          }
        ]
      })
    });

    const config = await Config.load();
    const list = new BranchesList(['--workspace', 'test-1234', '--database', 'test'], config as Config);
    list.locale = 'en-US';

    const printTable = vi.spyOn(list, 'printTable');

    await list.run();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/test');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(printTable).toHaveBeenCalledOnce();
    expect(printTable.mock.calls[0]).toMatchInlineSnapshot(`
      [
        [
          "Name",
          "Created at",
        ],
        [
          [
            "main",
            "Jan 1, 2020, 1:00 AM",
          ],
        ],
      ]
    `);
  });

  test('returns the data when JSON is enabled', async () => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        branches: [
          {
            name: 'main',
            createdAt: '2020-01-01T00:00:00.000Z'
          }
        ]
      })
    });

    const config = await Config.load();
    const list = new BranchesList(['--workspace', 'test-1234', '--database', 'test'], config as Config);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(true);

    const printTable = vi.spyOn(list, 'printTable');

    const result = await list.run();

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "createdAt": "2020-01-01T00:00:00.000Z",
          "name": "main",
        },
      ]
    `);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/test');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(printTable).not.toHaveBeenCalled();
  });
});
