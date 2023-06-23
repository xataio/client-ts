import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import WorkspaceCreate from './create.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('workspaces create', () => {
  test('fails if the workspace name is not provided', async () => {
    const config = await Config.load();
    const list = new WorkspaceCreate([], config);

    await expect(list.run()).rejects.toMatchInlineSnapshot(`
      [Error: Missing 1 required arg:
      workspace  The new workspace name
      See more help with --help]
    `);
  });

  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });

    const config = await Config.load();
    const list = new WorkspaceCreate(['hello world'], config);

    await expect(list.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces');
    expect(fetchMock.mock.calls[0][1].method).toEqual('POST');
  });

  test.each([[false], [true]])('performs the creation with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        id: 'hello-world-1234'
      })
    });

    const config = await Config.load();
    const list = new WorkspaceCreate(['hello world'], config);

    expect(WorkspaceCreate.enableJsonFlag).toBe(true);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(list, 'log');

    const result = await list.run();

    if (json) {
      expect(result).toEqual({
        id: 'hello-world-1234'
      });
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces');
    expect(fetchMock.mock.calls[0][1].method).toEqual('POST');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('✔ Workspace hello-world-1234 successfully created');
    }
  });
});
