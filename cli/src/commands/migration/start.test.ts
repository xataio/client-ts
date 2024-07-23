import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import MigrationStart from './start.js';
import * as fs from 'fs/promises';
import { baseFetch } from './utils.test.js';

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
      `Migration started with Job ID mig_job_cqfltm0knc8jbigtjb9g. Please use the "xata migration status main" command to check its status`
    );
  });
});
