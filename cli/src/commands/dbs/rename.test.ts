import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import DatabasesRename from './rename.js';

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

const fetchImplementation = (url: string, request: any) => {
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
  } else if (url === 'https://api.xata.io/workspaces/test-1234/dbs/db1/rename' && request.method === 'POST') {
    return {
      ok: true,
      json: async () => ({})
    };
  }
};

describe('databases rename', () => {
  test('succeeds if user specifies workspace, database and newName via prompt', async () => {
    const config = await Config.load();
    const command = new DatabasesRename([], config);
    fetchMock.mockImplementation(fetchImplementation);

    promptsMock.mockReturnValue({ workspace: 'test-1234', database: 'db1', newName: 'db2', confirm: 'db1' });
    await command.run();

    expect(fetchMock.mock.calls[2][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs/db1/rename');
    expect(fetchMock.mock.calls[2][1].method).toEqual('POST');
    expect(fetchMock.mock.calls[2][1].body).toEqual('{"newName":"db2"}');
  });

  test('exits if the user does not confirm', async () => {
    const config = await Config.load();
    const command = new DatabasesRename(['--workspace', 'test-1234', 'db1', 'db2'], config);

    promptsMock.mockReturnValue({});

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 1]');
  });

  test('exits if the user did not confirm the database name correctly', async () => {
    const config = await Config.load();
    const command = new DatabasesRename(['--workspace', 'test-1234', 'db1', 'db2'], config);

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
    promptsMock.mockReturnValue({ confirm: 'db1' });

    const config = await Config.load();
    const command = new DatabasesRename(['--workspace', 'test-1234', 'db1', 'db2'], config);

    await expect(command.run()).rejects.toThrow('Something went wrong');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs/db1/rename');
    expect(fetchMock.mock.calls[0][1].method).toEqual('POST');
    expect(fetchMock.mock.calls[0][1].body).toEqual('{"newName":"db2"}');
  });

  test.each([[false], [true]])('performs the deletion with JSON enabled = %o', async (json) => {
    fetchMock.mockImplementation(fetchImplementation);

    promptsMock.mockReturnValue({ confirm: 'db1' });

    const config = await Config.load();
    const command = new DatabasesRename(['--workspace', 'test-1234', 'db1', 'db2'], config);

    expect(DatabasesRename.enableJsonFlag).toBe(true);
    vi.spyOn(command, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(command, 'log');

    const result = await command.run();

    if (json) {
      expect(result).toEqual({});
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces/test-1234/dbs/db1/rename');
    expect(fetchMock.mock.calls[0][1].method).toEqual('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).newName).toEqual('db2');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('✔ Database test-1234/db1 successfully renamed to test-1234/db2');
    }
  });
});
