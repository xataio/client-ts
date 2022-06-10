import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import Login from './login.js';
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

describe('auth login', () => {
  test('checks if a key exists and exists if the user does not want to overwrite', async () => {
    const config = await Config.load();
    const command = new Login([], config as Config);

    const readFile = vi.spyOn(fs, 'readFile').mockResolvedValue('1234abcdef');

    promptsMock.mockReturnValue({ confirm: false });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 2]');

    expect(readFile).toHaveBeenCalledWith(keyPath, 'utf-8');
    expect(promptsMock).toHaveBeenCalledOnce();
    expect(promptsMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "message": "Authentication is already configured, do you want to overwrite it?",
          "name": "overwrite",
          "type": "confirm",
        },
      ]
    `);
  });

  test('exists if the user does not provide an API key', async () => {
    const config = await Config.load();
    const command = new Login([], config as Config);
    vi.spyOn(command, 'log').mockReturnValue(undefined); // silence output

    const readFile = vi.spyOn(fs, 'readFile').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    promptsMock.mockReturnValue({ key: '' });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 2]');

    expect(readFile).toHaveBeenCalledWith(keyPath, 'utf-8');
    expect(promptsMock).toHaveBeenCalledOnce();
    expect(promptsMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "message": "Introduce your API key:",
          "name": "key",
          "type": "password",
        },
      ]
    `);
  });

  test('validates the API key and writes it to a file', async () => {
    const config = await Config.load();
    const command = new Login([], config as Config);
    vi.spyOn(command, 'log').mockReturnValue(undefined); // silence output

    const readFile = vi.spyOn(fs, 'readFile').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    promptsMock.mockReturnValue({ key: '1234abcdef' });

    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });

    await command.run();

    expect(readFile).toHaveBeenCalledWith(keyPath, 'utf-8');
    expect(promptsMock).toHaveBeenCalledOnce();
    expect(promptsMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "message": "Introduce your API key:",
          "name": "key",
          "type": "password",
        },
      ]
    `);

    expect(fetchMock.mock.calls[0][0]).toEqual('https://api.xata.io/workspaces');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(fs.mkdir).toHaveBeenCalledWith(dirname(keyPath), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(keyPath, '1234abcdef', { mode: 0o600 });
  });
});
