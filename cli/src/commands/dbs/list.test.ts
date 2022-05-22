import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import DatabasesList from './list.js';

vi.mock('node-fetch');

clearEnvVariables();

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('databases list', () => {
  test('fails if no workspace is provided', async () => {
    const config = await Config.load();
    const list = new DatabasesList([], config as Config);

    await expect(list.run()).rejects.toThrow(
      'Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.'
    );
  });

  test.each([[false], [true]])('returns the data with enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        databases: [
          {
            name: 'test',
            createdAt: '2020-01-01T00:00:00.000Z',
            numberOfBranches: 3
          }
        ]
      })
    });

    const config = await Config.load();
    const list = new DatabasesList(['--workspace', 'test-1234'], config as Config);

    expect(DatabasesList.enableJsonFlag).toBe(true);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

    const printTable = vi.spyOn(list, 'printTable');

    const result = await list.run();

    if (json) {
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "createdAt": "2020-01-01T00:00:00.000Z",
            "name": "test",
            "numberOfBranches": 3,
          },
        ]
      `);
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(printTable).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(printTable.mock.calls[0]).toMatchInlineSnapshot(`
        [
          [
            "Database name",
            "Created at",
            "# branches",
          ],
          [
            [
              "test",
              "Jan 1, 2020, 1:00 AM",
              "3",
            ],
          ],
          [
            "l",
            "l",
            "r",
          ],
        ]
      `);
    }
  });
});
