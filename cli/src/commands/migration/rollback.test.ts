import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import MigrationRollback from './rollback.js';

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

export const baseFetch = (url: string, request: any) => {
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
      json: async () => ({
        usePgRoll: true,
        schema: { tables: [{ name: 'table1', columns: [{ name: 'description', type: 'string' }] }] }
      })
    };
  }

  if (url === `${baseUrl}/schema` && request.method === 'GET') {
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
                  name: 'description',
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

export const fetchEmptyStatus = (url: string, request: any) => {
  if (url === `${baseUrl}/migrations/status` && request.method === 'GET') {
    return {
      ok: true,
      status: 204,
      json: async () => null // 204, no content
    };
  } else {
    return baseFetch(url, request);
  }
};

export const fetchRunningMigrationWithSuccessfulRollback = (url: string, request: any) => {
  if (url === `${baseUrl}/migrations/status` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => {
        return {
          completedAt: '2024-07-22T16:52:55.125163Z',
          description: [
            {
              update: {
                mapping: {
                  description: '_pgroll_new_description'
                },
                name: 'description',
                table: 'table',
                type: 'column'
              }
            }
          ],
          jobID: 'mig_job_cqf8spc40ertajao726g',
          status: 'completed',
          type: 'start'
        };
      }
    };
  }

  if (url === `${baseUrl}/migrations/rollback` && request.method === 'POST') {
    return {
      ok: true,
      json: async () => {
        return { jobID: 'mig_job_cqfltm0knc8jbigtjb9g' };
      }
    };
  }

  return baseFetch(url, request);
};

promptsMock.mockReturnValue({ confirm: true, database: 'db1', workspace: 'test-1234' });

describe('migration rollback', () => {
  test('correctly detects if there is no migration to rollback', async () => {
    const config = await Config.load();
    const command = new MigrationRollback(['main'], config);
    const error = vi.spyOn(command, 'error');
    fetchMock.mockImplementation(fetchEmptyStatus);
    try {
      await command.run();
    } catch (e) {
      console.error(e);
    }
    expect(error).toHaveBeenCalledWith(`No active migration found, there is nothing to rollback.`);
  });

  test('correctly starts the migration rollback job, if an active migration is found', async () => {
    const config = await Config.load();
    const command = new MigrationRollback(['main'], config);
    const log = vi.spyOn(command, 'log');
    fetchMock.mockImplementation(fetchRunningMigrationWithSuccessfulRollback);
    await command.run();
    expect(log).toHaveBeenCalledWith(
      `Migration rollback started with Job ID mig_job_cqfltm0knc8jbigtjb9g. Please use the "xata migration status main" command to check its status`
    );
  });
});
