import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import BranchDelete from './delete.js';
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

describe('branches delete', () => {
  test('exists if the user does not confirm', async () => {
    const config = await Config.load();
    const command = new BranchDelete(['featureA'], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    promptsMock.mockReturnValue({});

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: EEXIT: 1]');
  });

  test('exists if the user did not enter the branch name correctly', async () => {
    const config = await Config.load();
    const command = new BranchDelete(['featureA'], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    promptsMock.mockReturnValue({ confirm: 'nope' });

    await expect(command.run()).rejects.toMatchInlineSnapshot('[Error: The branch name did not match]');
  });

  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });
    promptsMock.mockReturnValue({ confirm: 'featureA' });

    const config = await Config.load();
    const command = new BranchDelete(['featureA'], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.eu-west-1.xata.sh/db/test:featureA');
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');
  });

  test.each([[false], [true]])('performs the deletion with JSON enabled = %o', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });
    promptsMock.mockReturnValue({ confirm: 'featureA' });

    const config = await Config.load();
    const command = new BranchDelete(['featureA'], config);
    command.projectConfig = { databaseURL: 'https://test-1234.eu-west-1.xata.sh/db/test' };

    expect(BranchDelete.enableJsonFlag).toBe(true);
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
    expect(fetchMock.mock.calls[0][1].method).toEqual('DELETE');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('✔ Branch test:featureA in the test-1234 workspace successfully deleted');
    }
  });
});
