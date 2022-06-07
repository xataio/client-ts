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
  test('fails if the database name is not provided', async () => {
    const config = await Config.load();
    const command = new DatabasesDelete(['--workspace', 'test-1234'], config as Config);

    promptsMock.mockReturnValue({ confirm: false });

    await expect(command.run()).rejects.toMatchInlineSnapshot(`
      [Error: Missing 1 required arg:
      database  The database name to delete
      See more help with --help]
    `);
  });

  test('exists if the user does not confirm', async () => {
    const config = await Config.load();
    const command = new DatabasesDelete(['--workspace', 'test-1234', 'foo'], config as Config);

    promptsMock.mockReturnValue({ confirm: false });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 1]');
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
    const command = new DatabasesDelete(['--workspace', 'test-1234', 'foo'], config as Config);

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/foo');
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');
  });

  test.each([[false], [true]])('performs the deletion with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });
    promptsMock.mockReturnValue({ confirm: true });

    const config = await Config.load();
    const command = new DatabasesDelete(['--workspace', 'test-1234', 'foo'], config as Config);

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
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/foo');
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('Database test-1234/foo successfully deleted');
    }
  });
});
