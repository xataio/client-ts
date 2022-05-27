import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import Status from './status.js';
import prompts from 'prompts';
import * as fs from 'fs/promises';
import { keyPath } from '../../key.js';
import { dirname } from 'path';

vi.mock('node-fetch');
vi.mock('prompts');
vi.mock('fs/promises');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;

describe('auth status', () => {
  test('shows informational message when there is no api key configured', async () => {
    const config = await Config.load();
    const command = new Status([], config as Config);

    const readFile = vi.spyOn(fs, 'readFile').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const log = vi.spyOn(command, 'log').mockReturnValue(undefined);

    promptsMock.mockReturnValue({ confirm: false });

    await command.run();

    expect(readFile).toHaveBeenCalledWith(keyPath, 'utf-8');
    expect(log).toHaveBeenCalledWith('You are not logged in, run `xata auth login` first');
  });

  test('validates the API key if it exists', async () => {
    const config = await Config.load();
    const command = new Status([], config as Config);
    const log = vi.spyOn(command, 'log');

    const readFile = vi.spyOn(fs, 'readFile').mockResolvedValue('1234abcdef');

    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });

    await command.run();

    expect(readFile).toHaveBeenCalledWith(keyPath, 'utf-8');

    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(log.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Client is logged in",
        ],
        [
          "Checking access to the API...",
        ],
        [
          "API key is valid",
        ],
      ]
    `);
  });
});
