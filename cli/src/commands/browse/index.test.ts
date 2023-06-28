import { Config } from '@oclif/core';
import fetch from 'node-fetch';
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

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const openMock = open as unknown as ReturnType<typeof vi.fn>;

describe('browse', () => {
  test('works with a branch defined by the context', async () => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        branches: [
          {
            name: 'main',
            createdAt: '2020-01-01T00:00:00.000Z'
          }
        ],
        mapping: []
      })
    });

    const config = await Config.load();
    const command = new Browse([], config);
    command.projectConfig = {
      databaseURL: 'https://test-r5vcv5.eu-west-1.xata.sh/db/test'
    };
    process.env.XATA_BRANCH = 'main';

    await command.run();

    expect(open).toHaveBeenCalledOnce();
    expect(openMock.mock.calls[0][0]).toEqual(
      'https://app.xata.io/workspaces/test-r5vcv5/dbs/test:eu-west-1/branches/main'
    );
  });

  test('works with a branch specified with a flag', async () => {
    const config = await Config.load();
    const command = new Browse(['--branch', 'foo'], config);
    command.projectConfig = {
      databaseURL: 'https://test-r5vcv5.eu-west-1.xata.sh/db/test'
    };

    await command.run();

    expect(open).toHaveBeenCalledOnce();
    expect(openMock.mock.calls[0][0]).toEqual(
      'https://app.xata.io/workspaces/test-r5vcv5/dbs/test:eu-west-1/branches/foo'
    );
  });
});
