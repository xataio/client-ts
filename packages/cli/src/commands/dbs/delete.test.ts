import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import DatabasesDelete from './delete.js';
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

describe('databases delete', () => {
  test('succeeds if user specifies workspace and database via prompt', async () => {
    const config = await Config.load();
    const command = new DatabasesDelete([], config);
    fetchMock.mockImplementation((url, request) => {
      if (url === 'https://api.xata.io/workspaces' && request.method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            workspaces: [{ id: 'test-1234', name: 'test-1234' }]
          })
        };
      } else if (url === 'https://api.xata.io/workspaces/test-1234/dbs' && request.method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            databases: [{ name: 'db1' }]
          })
        };
      } else if (url === 'https://api.xata.io/workspaces/test-1234/dbs/db1' && request.method === 'DELETE') {
        return {
          ok: true,
          json: async () => ({})
        };
      }
    });

    promptsMock.mockReturnValue({ workspace: 'test-1234', database: 'db1', confirm: 'db1' });
    await command.run();

    expect(fetchMock.mock.calls[2][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs/db1');
    expect(fetchMock.mock.calls[2][1].method).toEqual('DELETE');
  });

  test('exits if the user does not confirm', async () => {
    const config = await Config.load();
    const command = new DatabasesDelete(['--workspace', 'test-1234', 'foo'], config);

    promptsMock.mockReturnValue({});

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 1]');
  });

  test('exits if the user did not confirm the database name correctly', async () => {
    const config = await Config.load();
    const command = new DatabasesDelete(['--workspace', 'test-1234', 'foo'], config);

    promptsMock.mockReturnValue({ confirm: 'nope' });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: The database name did not match]');
  });

  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });
    promptsMock.mockReturnValue({ confirm: 'foo' });

    const config = await Config.load();
    const command = new DatabasesDelete(['--workspace', 'test-1234', 'foo'], config);

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs/foo');
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');
  });

  test.each([[false], [true]])('performs the deletion with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });
    promptsMock.mockReturnValue({ confirm: 'foo' });

    const config = await Config.load();
    const command = new DatabasesDelete(['--workspace', 'test-1234', 'foo'], config);

    expect(DatabasesDelete.enableJsonFlag).toBe(true);
    vi.spyOn(command, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(command, 'log');

    const result = await command.run();

    if (json) {
      expect(result).toEqual({});
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs/foo');
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('✔ Database test-1234/foo successfully deleted');
    }
  });
});
