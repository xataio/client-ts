import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import WorkspacesDelete from './delete.js';
import prompts from 'prompts';

vi.mock('node-fetch');
vi.mock('prompts');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;

describe('workspaces delete', () => {
  test('fails if the workspace id is not provided', async () => {
    const config = await Config.load();
    const list = new WorkspacesDelete([], config as Config);

    promptsMock.mockReturnValue({ confirm: false });

    await expect(list.run()).rejects.toMatchInlineSnapshot(
      '[Error: Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.]'
    );
  });

  test('exists if the user does not confirm', async () => {
    const config = await Config.load();
    const list = new WorkspacesDelete(['--workspace', 'test-1234'], config as Config);

    promptsMock.mockReturnValue({ confirm: false });

    await expect(list.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 1]');
  });

  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });
    promptsMock.mockReturnValue({ confirm: true });

    const config = await Config.load();
    const list = new WorkspacesDelete(['--workspace', 'test-1234'], config as Config);

    await expect(list.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234');
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');
  });

  test.each([[false], [true]])('performs the deletion with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });
    promptsMock.mockReturnValue({ confirm: true });

    const config = await Config.load();
    const list = new WorkspacesDelete(['--workspace', 'test-1234'], config as Config);

    expect(WorkspacesDelete.enableJsonFlag).toBe(true);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(list, 'log');

    const result = await list.run();

    if (json) {
      expect(result).toEqual({});
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234');
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('Workspace test-1234 successfully deleted');
    }
  });
});
