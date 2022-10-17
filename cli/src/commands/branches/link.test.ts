import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import BranchesLink from './link.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('branches link', () => {
  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });

    const config = await Config.load();
    const command = new BranchesLink([], config as Config);
    command.projectConfig = { databaseURL: 'https://test-1234.xata.sh/db/test' };

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.length).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/test');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });

  test.each([[false], [true]])('performs the linking with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({ ok: true, json: async () => ({}) });

    const config = await Config.load();
    const command = new BranchesLink(['--git', 'foo', '--xata', 'bar'], config as Config);
    command.projectConfig = { databaseURL: 'https://test-1234.xata.sh/db/test' };

    expect(BranchesLink.enableJsonFlag).toBe(true);
    vi.spyOn(command, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(command, 'log');

    const result = await command.run();

    if (json) {
      expect(result).toMatchInlineSnapshot('{}');
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.length).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/dbs/test/gitBranches');
    expect(fetchMock.mock.calls[0][1].method).toEqual('POST');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('Branch foo successfully linked with bar');
    }
  });
});
