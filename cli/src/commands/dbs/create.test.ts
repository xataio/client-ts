import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import DatabasesCreate from './create.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('databases create', () => {
  test('fails if the database name is not provided', async () => {
    const config = await Config.load();
    const command = new DatabasesCreate(['--workspace', 'test-1234'], config as Config);

    await expect(command.run()).rejects.toMatchInlineSnapshot(`
      [Error: Missing 1 required arg:
      database  The new database name
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
    const command = new DatabasesCreate(['--workspace', 'test-1234', 'hello-world'], config as Config);

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/hello-world');
    expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');
  });

  test.each([[false], [true]])('performs the creation with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        databaseName: 'hello-world'
      })
    });

    const config = await Config.load();
    const command = new DatabasesCreate(['--workspace', 'test-1234', 'hello-world'], config as Config);

    expect(DatabasesCreate.enableJsonFlag).toBe(true);
    vi.spyOn(command, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(command, 'log');

    const result = await command.run();

    if (json) {
      expect(result).toMatchInlineSnapshot(`
        {
          "databaseName": "hello-world",
        }
      `);
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/hello-world');
    expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('Database hello-world successfully created');
    }
  });
});
