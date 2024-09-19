import { Config } from '@oclif/core';
import * as fs from 'fs/promises';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { credentialsFilePath } from '../../credentials.js';
import { clearEnvVariables } from '../utils.test.js';
import Logout from './logout.js';
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

const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;

describe('branches delete', () => {
  test('exists if there are no profile configured', async () => {
    const config = await Config.load();
    const command = new Logout([], config);

    const readFile = vi.spyOn(fs, 'readFile').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: You are not logged in]');

    expect(readFile).toHaveBeenCalledWith(credentialsFilePath, 'utf-8');
  });

  test('exists if the user does not confirm', async () => {
    const config = await Config.load();
    const command = new Logout([], config);

    const readFile = vi.spyOn(fs, 'readFile').mockResolvedValue(ini.stringify({ default: { apiKey: 'abcdef1234' } }));

    promptsMock.mockReturnValue({ confirm: false });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 2]');

    expect(readFile).toHaveBeenCalledWith(credentialsFilePath, 'utf-8');
    expect(promptsMock).toHaveBeenCalledOnce();
    expect(promptsMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "initial": true,
          "message": "Are you sure you want to logout of Xata?",
          "name": "confirm",
          "type": "confirm",
        },
      ]
    `);
  });

  test('updates the credentials file if the user confirms', async () => {
    const config = await Config.load();
    const command = new Logout([], config);

    const readFile = vi.spyOn(fs, 'readFile').mockResolvedValue(ini.stringify({ default: { apiKey: 'abcdef1234' } }));
    const writeFile = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    promptsMock.mockReturnValue({ confirm: true });

    await command.run();

    expect(readFile).toHaveBeenCalledWith(credentialsFilePath, 'utf-8');
    expect(promptsMock).toHaveBeenCalledOnce();
    expect(promptsMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "initial": true,
          "message": "Are you sure you want to logout of Xata?",
          "name": "confirm",
          "type": "confirm",
        },
      ]
    `);
    expect(writeFile).toHaveBeenCalledWith(credentialsFilePath, '', { mode: 0o600 });
  });
});
