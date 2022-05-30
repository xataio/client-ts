import { Config } from '@oclif/core';
import open from 'open';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import Browse from './index.js';

vi.mock('node-fetch');
vi.mock('open');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const openMock = open as unknown as ReturnType<typeof vi.fn>;

describe('browse', () => {
  test('works with a branch defined by the context', async () => {
    const config = await Config.load();
    const command = new Browse([], config as Config);
    command.projectConfig = {
      databaseURL: 'https://test-r5vcv5.xata.sh/db/test'
    };
    process.env.XATA_BRANCH = 'main';

    await command.run();

    expect(open).toHaveBeenCalledOnce();
    expect(openMock.mock.calls[0][0]).toEqual('https://app.xata.io/workspaces/test-r5vcv5/dbs/test/branches/main');
  });

  test('works with a branch specified with a flag', async () => {
    const config = await Config.load();
    const command = new Browse(['--branch', 'foo'], config as Config);
    command.projectConfig = {
      databaseURL: 'https://test-r5vcv5.xata.sh/db/test'
    };

    await command.run();

    expect(open).toHaveBeenCalledOnce();
    expect(openMock.mock.calls[0][0]).toEqual('https://app.xata.io/workspaces/test-r5vcv5/dbs/test/branches/foo');
  });
});
