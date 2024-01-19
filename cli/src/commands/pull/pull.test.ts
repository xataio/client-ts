import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import Pull from './index.js';
import { randomUUID } from 'crypto';

vi.mock('prompts');
vi.mock('node-fetch');
vi.mock('child_process');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
  process.env.XATA_BRANCH = 'main';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;

const REGION = 'us-east-1';

const baseFetchImplementation = (url: string, request: any) => {
  if (url === 'https://api.xata.io/workspaces' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        workspaces: [{ id: 'test-1234', name: 'test-1234' }]
      })
    };
  } else if (url === 'https://api.xata.io/workspaces/test-1234/dbs' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        databases: [{ name: 'db1', region: REGION }]
      })
    };
  } else if (url === `https://test-1234.${REGION}.xata.sh/db/db1:main` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({ schema: { tables: [{ name: 'table1', columns: [{ name: 'a', type: 'string' }] }] } })
    };
  } else if (url === `https://test-1234.${REGION}.xata.sh/dbs/db1` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => {
        return {
          branches: [{ name: 'main', id: 'main' }]
        };
      }
    };
  }
  throw new Error(`Unexpected fetch request: ${url} ${request.method}`);
};

const staticMigration = {
  id: 'mig_ce3lg2hp3o0em98s8r50',
  parentID: 'mig_ce3lfvhp3o0em98s8r40',
  checksum: '1:92d84ef84afc56e2152fd48d098d1b7ef4328217eadd5db6b3f646ac94a1a5ad',
  createdAt: '2021-08-05T18:56:00.000Z',
  operations: [
    {
      addColumn: {
        column: {
          name: 'test',
          type: 'string'
        },
        table: 'test'
      }
    }
  ]
};
const fetchImplementationTwo = (url: string, request: any) => {
  if (url === `https://test-1234.${REGION}.xata.sh/db/db1:main/schema/history` && request.method === 'POST') {
    return {
      ok: true,
      json: async () => ({
        meta: {
          cursor: 1,
          more: false
        },
        logs: [
          staticMigration,
          {
            id: `mig_${randomUUID()}`,
            parentID: `mig_${randomUUID()}`,
            checksum: `1:${randomUUID()}`,
            createdAt: '2021-08-05T18:56:00.000Z',
            operations: [
              {
                addColumn: {
                  column: {
                    name: 'test',
                    type: 'string'
                  },
                  table: 'test'
                }
              }
            ]
          }
        ]
      })
    };
  } else {
    return baseFetchImplementation(url, request);
  }
};
const fetchImplementation = (url: string, request: any) => {
  if (url === `https://test-1234.${REGION}.xata.sh/db/db1:main/schema/history` && request.method === 'POST') {
    return {
      ok: true,
      json: async () => ({
        meta: {
          cursor: 1,
          more: false
        },
        logs: [staticMigration]
      })
    };
  } else {
    return baseFetchImplementation(url, request);
  }
};
promptsMock.mockReturnValue({ workspace: 'test-1234', database: 'db1' });

describe('pull', () => {
  describe('for Xata 1.0 branches', () => {
    test('creates migrations locally if they do not yet exist', async () => {
      const config = await Config.load();
      const command = new Pull(['--force', 'main'], config);
      const log = vi.spyOn(command, 'log');
      fetchMock.mockImplementation(fetchImplementation);
      await command.run();
      expect(log).toHaveBeenCalledWith('Successfully pulled 1 migrations from main branch');
    });
    test('combines new remote migrations with existing local migrations', async () => {
      const config = await Config.load();
      const command = new Pull(['main'], config);
      const log = vi.spyOn(command, 'log');
      fetchMock.mockImplementation(fetchImplementationTwo);
      await command.run();
      expect(log).toHaveBeenCalledWith('Successfully pulled 1 migrations from main branch');
    });
    test('does not create migrations locally if they already exist locally', async () => {
      const config = await Config.load();
      const command = new Pull(['main'], config);
      const log = vi.spyOn(command, 'log');
      fetchMock.mockImplementation(fetchImplementation);
      await command.run();
      expect(log).toHaveBeenCalledWith('No new migrations to pull from main branch');
    });
  });
  describe.skip('for Xata 2.0 branches', () => {
    test('creates migrations locally if they do not yet exist', async () => {});
    test('combines new remote migrations with existing local migrations', async () => {});
    test('does not create migrations locally if they already exist locally', async () => {});
  });
});
