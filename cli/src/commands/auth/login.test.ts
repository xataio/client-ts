import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import Login from './login.js';
import prompts from 'prompts';
import * as fs from 'fs/promises';
import { credentialsPath } from '../../credentials.js';
import { dirname } from 'path';
import ini from 'ini';

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
  test('checks if the profile exists and exits if the user does not want to overwrite', async () => {
    const config = await Config.load();
    const command = new Login([], config as Config);

    const readFile = vi.spyOn(fs, 'readFile').mockResolvedValue(ini.stringify({ default: { apiKey: '1234abcdef' } }));

    promptsMock.mockReturnValue({ confirm: false });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 2]');

    expect(readFile).toHaveBeenCalledWith(credentialsPath, 'utf-8');
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

  test('exits if the user does not provide an API key', async () => {
    const config = await Config.load();
    const command = new Login([], config as Config);
    vi.spyOn(command, 'log').mockReturnValue(undefined); // silence output

    const readFile = vi.spyOn(fs, 'readFile').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    promptsMock.mockReturnValue({ key: '' });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 2]');

    expect(readFile).toHaveBeenCalledWith(credentialsPath, 'utf-8');
    expect(promptsMock).toHaveBeenCalledOnce();
    expect(promptsMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "choices": [
            {
              "title": "Create a new API key opening a browser",
              "value": "create",
            },
            {
              "title": "Existing API key",
              "value": "existing",
            },
          ],
          "message": "Do you want to use an existing API key or create a new API key?",
          "name": "decision",
          "type": "select",
        },
      ]
    `);
  });

  test('validates the API key and writes it to the credentials file', async () => {
    const config = await Config.load();
    const command = new Login([], config as Config);
    vi.spyOn(command, 'log').mockReturnValue(undefined); // silence output

    const readFile = vi.spyOn(fs, 'readFile').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    // We are mocking a response that is valid for the two prompts that will be rendered
    promptsMock.mockReturnValue({ decision: 'existing', key: '1234abcdef' });

    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });

    await command.run();

    expect(readFile).toHaveBeenCalledWith(credentialsPath, 'utf-8');
    expect(promptsMock).toHaveBeenCalledTimes(2);
    expect(promptsMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "choices": [
            {
              "title": "Create a new API key opening a browser",
              "value": "create",
            },
            {
              "title": "Existing API key",
              "value": "existing",
            },
          ],
          "message": "Do you want to use an existing API key or create a new API key?",
          "name": "decision",
          "type": "select",
        },
      ]
    `);
    expect(promptsMock.mock.calls[1]).toMatchInlineSnapshot(`
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

    expect(fs.mkdir).toHaveBeenCalledWith(dirname(credentialsPath), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(credentialsPath, ini.stringify({ default: { apiKey: '1234abcdef' } }), {
      mode: 0o600
    });
  });
});
