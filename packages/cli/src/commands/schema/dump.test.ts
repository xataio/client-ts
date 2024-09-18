import { Config } from '@oclif/core';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import SchemaDump from './dump.js';

vi.mock('node-fetch');
vi.mock('fs/promises');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
  process.env.XATA_BRANCH = 'main';
  process.env.XATA_DATABASE_URL = 'https://mock.eu-west-1.xata.sh/db/xata';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

const mockSchema = {
  tables: [
    {
      name: 'users',
      columns: [
        {
          name: 'name',
          type: 'string'
        }
      ]
    }
  ]
};

describe('schema dump', () => {
  test('returns the schema if no file was specified', async () => {
    const config = await Config.load();
    const command = new SchemaDump([], config);

    const writeFile = vi.spyOn(fs, 'writeFile');

    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({ schema: mockSchema })
    });

    const schema = await command.run();

    expect(schema).toEqual(mockSchema);

    expect(writeFile).not.toHaveBeenCalled();

    expect(fetchMock.mock.calls[0][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });

  test('writes to a file when specified', async () => {
    const config = await Config.load();
    const command = new SchemaDump(['-f', 'schema.json'], config);

    const writeFile = vi.spyOn(fs, 'writeFile');

    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({ schema: mockSchema })
    });

    const schema = await command.run();

    expect(schema).toBe(undefined);

    expect(writeFile).toHaveBeenCalledWith('schema.json', JSON.stringify(mockSchema, null, 2));

    expect(fetchMock.mock.calls[0][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });
});
