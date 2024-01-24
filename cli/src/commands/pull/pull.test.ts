import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import Pull from './index.js';
import { randomUUID } from 'crypto';
import { Schemas } from '@xata.io/client';
import * as fs from 'fs/promises';
import { Dirent } from 'fs';

vi.mock('prompts');
vi.mock('node-fetch');
vi.mock('fs/promises');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
  process.env.XATA_BRANCH = 'main';
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;

const REGION = 'us-east-1';
const baseUrl = `https://test-1234.${REGION}.xata.sh/db/db1:main`;

const baseFetch = (url: string, request: any) => {
  if (url === 'https://api.xata.io/workspaces' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        workspaces: [{ id: 'test-1234', name: 'test-1234' }]
      })
    };
  }

  if (url === 'https://api.xata.io/workspaces/test-1234/dbs' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        databases: [{ name: 'db1', region: REGION }]
      })
    };
  }

  if (url === `${baseUrl}` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({ schema: { tables: [{ name: 'table1', columns: [{ name: 'a', type: 'string' }] }] } })
    };
  }

  throw new Error(`Unexpected fetch request: ${url} ${request.method}`);
};

const staticMigrationId = 'mig_ce3lg2hp3o0em98s8r50';
const staticMigration: Schemas.MigrationObject = {
  id: staticMigrationId,
  parentID: 'mig_ce3lfvhp3o0em98s8r40',
  checksum: '1:92d84ef84afc56e2152fd48d098d1b7ef4328217eadd5db6b3f646ac94a1a5ad',
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

const fetchMultiple = (url: string, request: any) => {
  if (url === `${baseUrl}/schema/history` && request.method === 'POST') {
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
          } as Schemas.MigrationObject
        ]
      })
    };
  }

  return baseFetch(url, request);
};

const fetchSingle = (url: string, request: any) => {
  if (url === `${baseUrl}/schema/history` && request.method === 'POST') {
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
  }

  return baseFetch(url, request);
};

promptsMock.mockReturnValue({ workspace: 'test-1234', database: 'db1' });

describe('pull', () => {
  describe('for Xata 1.0 branches', () => {
    test('creates migrations locally if they do not yet exist', async () => {
      const config = await Config.load();
      const command = new Pull(['--force', 'main'], config);

      const log = vi.spyOn(command, 'log');
      fetchMock.mockImplementation(fetchSingle);
      vi.spyOn(fs, 'readdir').mockImplementation(async () => []);
      vi.spyOn(fs, 'readFile').mockImplementation(async () => '');

      await command.run();

      expect(log).toHaveBeenCalledWith('Successfully pulled 1 migrations from main branch');
    });

    test('combines new remote migrations with existing local migrations', async () => {
      const config = await Config.load();
      const command = new Pull(['main'], config);

      const log = vi.spyOn(command, 'log');
      vi.spyOn(fs, 'readdir').mockImplementation(async () => [staticMigrationId as unknown as Dirent]);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => JSON.stringify(staticMigration));
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => staticMigrationId);
      fetchMock.mockImplementation(fetchMultiple);

      await command.run();

      expect(log).toHaveBeenCalledWith('Successfully pulled 1 migrations from main branch');
    });

    test('does not create migrations locally if they already exist locally', async () => {
      const config = await Config.load();
      const command = new Pull(['main'], config);

      const log = vi.spyOn(command, 'log');
      vi.spyOn(fs, 'readdir').mockImplementation(async () => [staticMigrationId as unknown as Dirent]);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => JSON.stringify(staticMigration));
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => staticMigrationId);
      fetchMock.mockImplementation(fetchSingle);

      await command.run();

      expect(log).toHaveBeenCalledWith('No new migrations to pull from main branch');
    });
  });
});
