import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import WorkspacesList from './list.js';

vi.mock('node-fetch');

clearEnvVariables();

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('workspaces list', () => {
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
    const list = new WorkspacesList(['--workspace', 'test-1234'], config as Config);

    expect(WorkspacesList.enableJsonFlag).toBe(true);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

    const printTable = vi.spyOn(list, 'printTable');

    const result = await list.run();

    if (json) {
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "id": "test-1234",
            "name": "test",
            "role": "Maintainer",
          },
        ]
      `);
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(printTable).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(printTable.mock.calls[0]).toMatchInlineSnapshot(`
        [
          [
            "Name",
            "Id",
            "Role",
          ],
          [
            [
              "test",
              "test-1234",
              "Maintainer",
            ],
          ],
        ]
      `);
    }
  });
});
