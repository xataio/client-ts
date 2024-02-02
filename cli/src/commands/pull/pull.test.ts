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
import { allMigrationsPgRollFormat, hydrateMigrationObject } from '../../migrations/pgroll.js';

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
  } else if (url === 'https://api.xata.io/workspaces/test-1234/dbs' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        databases: [{ name: 'db1', region: REGION }]
      })
    };
  } else if (url === `${baseUrl}` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({ schema: { tables: [{ name: 'table1', columns: [{ name: 'a', type: 'string' }] }] } })
    };
  } else if (url === `https://test-1234.us-east-1.xata.sh/db/db1:main/schema` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        schema: {
          name: 'bb_hmtsb6hnd552p1rencda7oo3eg_3hae5b',
          tables: {
            table1: {
              oid: '747164',
              name: 'table1',
              comment: '',
              columns: {
                a: {
                  name: 'a',
                  type: 'string',
                  default: null,
                  nullable: true,
                  unique: false,
                  comment: ''
                },
                xata_createdat: {
                  name: '_createdat',
                  type: 'timestamptz',
                  default: 'now()',
                  nullable: false,
                  unique: false,
                  comment: ''
                },
                xata_id: {
                  name: '_id',
                  type: 'text',
                  default: null,
                  nullable: false,
                  unique: true,
                  comment: ''
                },
                xata_updatedat: {
                  name: '_updatedat',
                  type: 'timestamptz',
                  default: 'now()',
                  nullable: false,
                  unique: false,
                  comment: ''
                },
                xata_version: {
                  name: '_version',
                  type: 'integer',
                  default: '0',
                  nullable: false,
                  unique: false,
                  comment: ''
                }
              },
              indexes: {},
              primaryKey: ['xata_id'],
              foreignKeys: null,
              checkConstraints: null,
              uniqueConstraints: null
            }
          }
        }
      })
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
  } else {
    return baseFetch(url, request);
  }
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
  } else {
    return baseFetch(url, request);
  }
};

const pgrollMigration1: Schemas.PgRollMigrationHistoryItem = {
  done: false,
  migration: `{"name": "mig_cmkjcdrj7c92neg7lnmg", "operations": [{"drop_column": {"down": "", "table": "tester", "column": "Firstname"}}]}`,
  migrationType: 'pgroll',
  name: 'mig_cmkjcdrj7c92neg7lnmg',
  parent: 'mig_cmkjccmg1th0of00f5n0',
  startedAt: '2024-01-18T14:31:20.795975Z'
};

const pgrollMigration2: Schemas.PgRollMigrationHistoryItem = {
  done: true,
  migration:
    '{"name": "mig_abcdcdrj7c92neg7lefg", "operations": [{"sql": { "up": "ALTER ALTER TABLE internal ADD test varchar(255)" }}]}',
  migrationType: 'inferred',
  name: 'mig_abcdcdrj7c92neg7lefg',
  parent: 'mig_abcdcdrj7c92neg7lerr',
  startedAt: '2024-01-18T14:31:20.795975Z'
};
const pgrollMigration3: Schemas.PgRollMigrationHistoryItem = {
  done: true,
  migration:
    '{"name": "mig_abcdcdrj7c92neg7lefg", "operations": [{"drop_column": {"down": "", "table": "tester", "column": "Firstname"}}]}',
  migrationType: 'pgroll',
  name: 'mig_abcdcdrj7c92neg7lefg',
  parent: 'mig_abcdcdrj7c92neg7lerr',
  startedAt: '2024-01-18T14:31:20.795975Z'
};
const pgrollMigration4: Schemas.PgRollMigrationHistoryItem = {
  done: true,
  migration:
    '{"name": "mig_xyzdcdrj7c92neg7lxyz", "operations": [{"drop_column": {"down": "", "table": "tester", "column": "Firstname"}}]}',
  migrationType: 'pgroll',
  name: 'mig_xyzdcdrj7c92neg7lxyz',
  parent: 'mig_xyzdcdrj7c92neg7lxyz',
  startedAt: '2024-01-18T14:31:20.795975Z'
};

const pgrollFetchSingle = (url: string, request: any) => {
  if (url === `${baseUrl}` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        usePgRoll: true,
        schema: { tables: [{ name: 'table1', columns: [{ name: 'a', type: 'string' }] }] }
      })
    };
  } else if (url === `${baseUrl}/pgroll/migrations` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        migrations: [pgrollMigration1]
      })
    };
  } else {
    return baseFetch(url, request);
  }
};

const pgrollFetchMultiple = (url: string, request: any) => {
  if (url === `${baseUrl}` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        usePgRoll: true,
        schema: { tables: [{ name: 'table1', columns: [{ name: 'a', type: 'string' }] }] }
      })
    };
  } else if (url === `${baseUrl}/pgroll/migrations` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        migrations: [pgrollMigration1, pgrollMigration3, pgrollMigration4]
      })
    };
  } else {
    return baseFetch(url, request);
  }
};

describe('pull', () => {
  describe('for Xata 1.0 branches', () => {
    promptsMock.mockReturnValue({ workspace: 'test-1234', database: 'db1' });

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

  describe('for Xata 2.0 branches', () => {
    test('creates migrations locally if they do not yet exist', async () => {
      const config = await Config.load();
      const command = new Pull(['--force', 'main'], config);
      const log = vi.spyOn(command, 'log');
      vi.spyOn(fs, 'readdir').mockImplementation(async () => []);
      vi.spyOn(fs, 'readFile').mockImplementation(async () => '');
      fetchMock.mockImplementation(pgrollFetchSingle);
      promptsMock.mockReturnValueOnce({ workspace: 'test-1234', database: 'db1' });
      await command.run();
      expect(log).toHaveBeenCalledWith('Successfully pulled 1 migrations from main branch');
    });

    test('combines new remote migrations with existing local migrations when they are both in the correct format', async () => {
      const config = await Config.load();
      const command = new Pull(['main'], config);
      const log = vi.spyOn(command, 'log');
      vi.spyOn(fs, 'readdir').mockImplementation(async () => [pgrollMigration1.name] as unknown as Dirent[]);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () =>
        JSON.stringify(hydrateMigrationObject(pgrollMigration1))
      );
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => pgrollMigration1.name);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () =>
        JSON.stringify(hydrateMigrationObject(pgrollMigration1))
      );
      fetchMock.mockImplementation(pgrollFetchMultiple);
      promptsMock.mockReturnValueOnce({ workspace: 'test-1234', database: 'db1' });
      await command.run();
      expect(log).not.toHaveBeenCalledWith('Converting existing migrations to pgroll format from main branch');
      expect(log).toHaveBeenCalledWith('Successfully pulled 2 migrations from main branch');
    });

    test('overwrites all old migrations if they are in the wrong format', async () => {
      const config = await Config.load();
      const command = new Pull(['main'], config);
      const log = vi.spyOn(command, 'log');
      vi.spyOn(fs, 'readdir').mockImplementationOnce(async () => [] as unknown as Dirent[]);
      vi.spyOn(fs, 'readdir').mockImplementationOnce(async () => [staticMigrationId] as unknown as Dirent[]);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => '');
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => staticMigrationId);
      fetchMock.mockImplementation(pgrollFetchSingle);
      promptsMock.mockReturnValueOnce({ workspace: 'test-1234', database: 'db1' });
      promptsMock.mockReturnValueOnce({ confirm: true });
      await command.run();
      expect(log).toHaveBeenCalledWith('Converting existing migrations to pgroll format from main branch');
      expect(log).toHaveBeenCalledWith('Successfully pulled 1 migrations from main branch');
    });

    test('does not create migrations locally if they already exist locally', async () => {
      const config = await Config.load();
      const command = new Pull(['main'], config);
      const log = vi.spyOn(command, 'log');
      vi.spyOn(fs, 'readdir').mockImplementation(async () => [pgrollMigration1.name] as unknown as Dirent[]);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () =>
        JSON.stringify(hydrateMigrationObject(pgrollMigration1))
      );
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => pgrollMigration1.name);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () =>
        JSON.stringify(hydrateMigrationObject(pgrollMigration1))
      );
      fetchMock.mockImplementation(pgrollFetchSingle);
      promptsMock.mockReturnValueOnce({ workspace: 'test-1234', database: 'db1' });
      promptsMock.mockReturnValueOnce({ confirm: true });
      await command.run();
      expect(log).not.toHaveBeenCalledWith('Converting existing migrations to pgroll format from main branch');
      expect(log).toHaveBeenCalledWith('No new migrations to pull from main branch');
    });

    test.only('allMigrationsPgRollFormat helper', async () => {
      vi.spyOn(fs, 'readdir').mockImplementationOnce(async () => [pgrollMigration1.name] as unknown as Dirent[]);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => pgrollMigration1.name);
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () =>
        JSON.stringify(hydrateMigrationObject(pgrollMigration1))
      );
      expect(await allMigrationsPgRollFormat()).toBe(true);
    });

    describe('inferred migration format', () => {
      test('allMigrationsPgRollFormat helper', async () => {
        vi.spyOn(fs, 'readdir').mockImplementationOnce(async () => [pgrollMigration2.name] as unknown as Dirent[]);
        vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => pgrollMigration2.name);
        vi.spyOn(fs, 'readFile').mockImplementationOnce(async () =>
          JSON.stringify(hydrateMigrationObject(pgrollMigration2))
        );
        expect(await allMigrationsPgRollFormat()).toBe(true);
      });
    });
  });
});
