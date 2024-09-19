import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import BranchCreate from './create.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('branches create', () => {
  test('fails if the branch name is not provided', async () => {
    const config = await Config.load();
    const command = new BranchCreate([], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    await expect(command.run()).rejects.toMatchInlineSnapshot(`
      [Error: Missing 1 required arg:
      branch  The new branch name
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
    const command = new BranchCreate(['featureA'], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.eu-west-1.xata.sh/db/test:featureA');
    expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');
  });

  test('fails if the request times out', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      }
    });

    const config = await Config.load();
    const command = new BranchCreate(['featureA'], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    await expect(command.run()).rejects.toThrow('Failed to create branch');
  });

  test.each([[false], [true]])('performs the creation with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });

    const config = await Config.load();
    const command = new BranchCreate(['featureA'], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    expect(BranchCreate.enableJsonFlag).toBe(true);
    vi.spyOn(command, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(command, 'log');

    const result = await command.run();

    if (json) {
      expect(result).toEqual({});
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.eu-west-1.xata.sh/db/test:featureA');
    expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('✔ Branch featureA successfully created');
    }
  });
});
