import { Config } from '@oclif/core';
import { describe, expect, test, vi } from 'vitest';
import { BaseCommand } from './base.js';
import dotenv from 'dotenv';
import { clearEnvVariables } from './commands/utils.test.js';

vi.mock('dotenv');

class FakeCommand extends BaseCommand<typeof FakeCommand> {
  async run() {
    // do nothing
  }
}

clearEnvVariables();

describe('init', () => {
  test('loads env files in the desired order', async () => {
    const config = await Config.load();
    const command = new FakeCommand([], config);
    const dotenvConfig = vi.spyOn(dotenv, 'config').mockImplementation(() => ({
      parsed: {}
    }));

    await command.init();

    expect(dotenvConfig).toHaveBeenNthCalledWith(1, { path: '.env.local' });
    expect(dotenvConfig).toHaveBeenNthCalledWith(2, { path: '.env' });

    expect(command.apiKeyLocation).toBeUndefined();
    expect(command.apiKeyDotenvLocation).toEqual('');

    expect(process.env.XATA_API_KEY).toBeUndefined();
  });
  test('works if the files do not exist', async () => {
    const config = await Config.load();
    const command = new FakeCommand([], config);
    const dotenvConfig = vi.spyOn(dotenv, 'config').mockImplementation(() => ({
      parsed: undefined
    }));

    await command.init();

    expect(dotenvConfig).toHaveBeenNthCalledWith(1, { path: '.env.local' });
    expect(dotenvConfig).toHaveBeenNthCalledWith(2, { path: '.env' });

    expect(command.apiKeyLocation).toBeUndefined();
    expect(command.apiKeyDotenvLocation).toEqual('');

    expect(process.env.XATA_API_KEY).toBeUndefined();
  });

  test('loads env variables from process.env if available', async () => {
    const config = await Config.load();
    const command = new FakeCommand([], config);
    const dotenvConfig = vi.spyOn(dotenv, 'config').mockImplementation(() => ({
      parsed: {
        XATA_API_KEY: 'override'
      }
    }));
    process.env.XATA_API_KEY = 'key';

    await command.init();

    expect(dotenvConfig).toHaveBeenNthCalledWith(1, { path: '.env.local' });
    expect(dotenvConfig).toHaveBeenNthCalledWith(2, { path: '.env' });

    expect(command.apiKeyLocation).toEqual('shell');
    expect(command.apiKeyDotenvLocation).toEqual('');

    expect(process.env.XATA_API_KEY).toEqual('key');
  });

  test('loads env variables from env files', async () => {
    const config = await Config.load();
    const command = new FakeCommand([], config);
    const dotenvConfig = vi.spyOn(dotenv, 'config').mockImplementation(() => ({
      parsed: {
        XATA_API_KEY: 'key'
      }
    }));

    await command.init();

    expect(dotenvConfig).toHaveBeenNthCalledWith(1, { path: '.env.local' });
    expect(dotenvConfig).toHaveBeenNthCalledWith(2, { path: '.env' });

    expect(command.apiKeyLocation).toEqual('dotenv');
    expect(command.apiKeyDotenvLocation).toEqual('.env.local');

    expect(process.env.XATA_API_KEY).toEqual('key');
  });

  test('does not override env variables from previous env files', async () => {
    const config = await Config.load();
    const command = new FakeCommand([], config);
    const dotenvConfig = vi.spyOn(dotenv, 'config').mockImplementation((options) => {
      return {
        parsed: {
          XATA_API_KEY: options?.path === '.env.local' ? 'key' : 'override'
        }
      };
    });

    await command.init();

    expect(dotenvConfig).toHaveBeenNthCalledWith(1, { path: '.env.local' });
    expect(dotenvConfig).toHaveBeenNthCalledWith(2, { path: '.env' });

    expect(command.apiKeyLocation).toEqual('dotenv');
    expect(command.apiKeyDotenvLocation).toEqual('.env.local');

    expect(process.env.XATA_API_KEY).toEqual('key');
  });

  test('sets env variables if previous env files did not contain them', async () => {
    const config = await Config.load();
    const command = new FakeCommand([], config);
    const dotenvConfig = vi.spyOn(dotenv, 'config').mockImplementation((options) => {
      return options?.path === '.env'
        ? {
            parsed: {
              XATA_API_KEY: 'key'
            }
          }
        : {};
    });

    await command.init();

    expect(dotenvConfig).toHaveBeenNthCalledWith(1, { path: '.env.local' });
    expect(dotenvConfig).toHaveBeenNthCalledWith(2, { path: '.env' });

    expect(command.apiKeyLocation).toEqual('dotenv');
    expect(command.apiKeyDotenvLocation).toEqual('.env');

    expect(process.env.XATA_API_KEY).toEqual('key');
  });

  test('performs variable expansions', async () => {
    const config = await Config.load();
    const command = new FakeCommand([], config);
    const dotenvConfig = vi.spyOn(dotenv, 'config').mockImplementation(() => ({
      parsed: {
        FOO: 'key',
        XATA_API_KEY: '${FOO}'
      }
    }));

    await command.init();

    expect(dotenvConfig).toHaveBeenNthCalledWith(1, { path: '.env.local' });
    expect(dotenvConfig).toHaveBeenNthCalledWith(2, { path: '.env' });

    expect(command.apiKeyLocation).toEqual('dotenv');
    expect(command.apiKeyDotenvLocation).toEqual('.env.local');

    expect(process.env.XATA_API_KEY).toEqual('key');
  });
});
