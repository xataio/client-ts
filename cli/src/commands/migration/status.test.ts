import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import MigrationStatus from './status.js';
import chalk from 'chalk';

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

// Note: the following mocks follow the fetch<type>_<status>Status pattern

const fetchComplete_CompletedStatus = (url: string, request: any) => {
  if (url === `${baseUrl}/migrations/status` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => {
        return {
          completedAt: '2024-07-22T09:41:54.695893Z',
          jobID: 'mig_job_cqf2inp20majlmbjukh0',
          status: 'completed',
          type: 'complete'
        };
      }
    };
  } else {
    return baseFetch(url, request);
  }
};

export const fetchStart_CompletedStatus = (url: string, request: any) => {
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
  } else {
    return baseFetch(url, request);
  }
};

const fetchRollback_CompletedStatus = (url: string, request: any) => {
  if (url === `${baseUrl}/migrations/status` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => {
        return {
          completedAt: '2024-07-22T16:59:46.41859Z',
          jobID: 'mig_job_cqf8vvk40ertajao7270',
          status: 'completed',
          type: 'rollback'
        };
      }
    };
  } else {
    return baseFetch(url, request);
  }
};

promptsMock.mockReturnValue({ confirm: true, database: 'db1', workspace: 'test-1234' });

describe('migration status', () => {
  test('correctly detects if migration status is run in a project with no migrations', async () => {
    const config = await Config.load();
    const command = new MigrationStatus(['main'], config);
    const error = vi.spyOn(command, 'error');
    fetchMock.mockImplementation(fetchEmptyStatus);
    try {
      await command.run();
    } catch (e) {
      console.error(e);
    }
    expect(error).toHaveBeenCalledWith(
      `No migrations found. Please create a new migration with "xata migrate start <branch-name>" command.`
    );
  });

  test('correctly prints the status, if last migration was command complete and the job is completed', async () => {
    const config = await Config.load();
    const command = new MigrationStatus(['main'], config);
    const printTable = vi.spyOn(command, 'printTable');
    fetchMock.mockImplementation(fetchComplete_CompletedStatus);
    await command.run();
    expect(printTable).toHaveBeenCalledWith(
      ['Job ID', 'Type', 'Job Status', 'Migration Status', 'Completed At'],
      [['mig_job_cqf2inp20majlmbjukh0', 'complete', 'completed', 'completed', '2024-07-22T09:41:54.695893Z']]
    );
  });

  test('correctly prints the status, if last migration was command start and the job is completed', async () => {
    const config = await Config.load();
    const command = new MigrationStatus(['main'], config);
    const printTable = vi.spyOn(command, 'printTable');
    fetchMock.mockImplementation(fetchStart_CompletedStatus);
    await command.run();
    expect(printTable).toHaveBeenCalledWith(
      ['Job ID', 'Type', 'Job Status', 'Migration Status', 'Completed At'],
      [['mig_job_cqf8spc40ertajao726g', 'start', 'completed', 'active', '2024-07-22T16:52:55.125163Z']]
    );
  });

  test('correctly prints the status, if last migration was command rollback and the job is completed', async () => {
    const config = await Config.load();
    const command = new MigrationStatus(['main'], config);
    const printTable = vi.spyOn(command, 'printTable');
    fetchMock.mockImplementation(fetchRollback_CompletedStatus);
    await command.run();
    expect(printTable).toHaveBeenCalledWith(
      ['Job ID', 'Type', 'Job Status', 'Migration Status', 'Completed At'],
      [['mig_job_cqf8vvk40ertajao7270', 'rollback', 'completed', 'completed', '2024-07-22T16:59:46.41859Z']]
    );
  });
});
