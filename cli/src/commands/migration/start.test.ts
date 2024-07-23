import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import MigrationStart from './start.js';
import * as fs from 'fs/promises';

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

export const fetchEmptyStatusAndSuccessfulStart = (url: string, request: any) => {
  if (url === `${baseUrl}/migrations/status` && request.method === 'GET') {
    return fetchEmptyStatus(url, request);
  }
  if (url === `${baseUrl}/migrations/start` && request.method === 'POST') {
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

describe('migration start', () => {
  test('fails if neither a migration file nor an inline migration is supplied', async () => {
    const config = await Config.load();
    const command = new MigrationStart(['main'], config);
    const error = vi.spyOn(command, 'error');
    fetchMock.mockImplementation(fetchEmptyStatus);
    try {
      await command.run();
    } catch (e) {
      console.error(e);
    }
    expect(error).toHaveBeenCalledWith(
      `Neither a migration file nor an inline migration operation JSON supplied. Please provide a migration to start.`
    );
  });

  test('fails if a supplied migration file does not have valid json', async () => {
    const config = await Config.load();
    // Note: we didn't mock the migration.json file, so this will fail with invalid Json as safeFileRead returns undefined
    const command = new MigrationStart(['main', 'migration.json'], config);
    const error = vi.spyOn(command, 'error');
    fetchMock.mockImplementation(fetchEmptyStatus);
    try {
      await command.run();
    } catch (e) {
      console.error(e);
    }
    expect(error).toHaveBeenCalledWith(`Failed to parse the supplied migration operations JSON string.`);
  });

  test('correctly submits the start migration job, if supplied migration file is valid', async () => {
    const config = await Config.load();
    const command = new MigrationStart(['main', 'migration.json'], config);
    const log = vi.spyOn(command, 'log');
    fetchMock.mockImplementation(fetchEmptyStatusAndSuccessfulStart);
    try {
      vi.spyOn(fs, 'readFile').mockImplementationOnce(async () =>
        JSON.stringify([
          {
            alter_column: {
              table: 'table',
              column: 'description',
              type: 'text',
              up: 'description',
              down: 'description'
            }
          }
        ])
      );
      await command.run();
    } catch (e) {
      console.error(e);
    }
    expect(log).toHaveBeenCalledWith(
      `Migration started with Job ID mig_job_cqfltm0knc8jbigtjb9g. Please use the xata migration status main command to check its status`
    );
  });
});
