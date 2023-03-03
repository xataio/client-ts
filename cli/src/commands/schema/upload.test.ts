import { Config } from '@oclif/core';
import { Responses } from '@xata.io/client';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import UploadSchema from './upload.js';

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

const mockSchema = { tables: [{ name: 'users', columns: [{ name: 'name', type: 'string' as const }] }] };

describe('schema upload', () => {
  test('uploads a schema, but no operations are done', async () => {
    const config = await Config.load();
    const command = new UploadSchema(['file.json', '--yes'], config);

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async (): Promise<Responses.SchemaCompareResponse> => ({
        source: mockSchema,
        target: mockSchema,
        edits: { operations: [] }
      })
    });

    const readFile = vi.spyOn(fs, 'readFile');

    readFile.mockReturnValue(Promise.resolve(JSON.stringify(mockSchema)));

    await command.run();

    expect(readFile).toHaveBeenCalled();

    expect(fetchMock.mock.calls.length).toEqual(1);

    expect(fetchMock.mock.calls[0][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main/schema/compare');
    expect(fetchMock.mock.calls[0][1].method).toEqual('POST');
  });

  test('uploads a schema, and operations are done', async () => {
    const config = await Config.load();
    const command = new UploadSchema(['file.json', '--yes'], config);

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async (): Promise<Responses.SchemaCompareResponse> => ({
        source: mockSchema,
        target: mockSchema,
        edits: { operations: [{ addColumn: { table: 'users', column: { name: 'age', type: 'int' as const } } }] }
      })
    });

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async () => ({})
    });

    const readFile = vi.spyOn(fs, 'readFile');

    readFile.mockReturnValue(Promise.resolve(JSON.stringify(mockSchema)));

    await command.run();

    expect(readFile).toHaveBeenCalled();

    expect(fetchMock.mock.calls.length).toEqual(2);

    expect(fetchMock.mock.calls[0][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main/schema/compare');
    expect(fetchMock.mock.calls[0][1].method).toEqual('POST');

    expect(fetchMock.mock.calls[1][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main/schema/apply');
    expect(fetchMock.mock.calls[1][1].method).toEqual('POST');
  });

  test('uploads a schema, with create-only, and operations are done', async () => {
    const config = await Config.load();
    const command = new UploadSchema(['file.json', '--yes', '--create-only'], config);

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async () => ({
        schema: { tables: [] }
      })
    });

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async (): Promise<Responses.SchemaCompareResponse> => ({
        source: mockSchema,
        target: mockSchema,
        edits: { operations: [{ addColumn: { table: 'users', column: { name: 'age', type: 'int' as const } } }] }
      })
    });

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async () => ({})
    });

    const readFile = vi.spyOn(fs, 'readFile');

    readFile.mockReturnValue(Promise.resolve(JSON.stringify(mockSchema)));

    await command.run();

    expect(readFile).toHaveBeenCalled();

    expect(fetchMock.mock.calls.length).toEqual(3);

    expect(fetchMock.mock.calls[0][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(fetchMock.mock.calls[1][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main/schema/compare');
    expect(fetchMock.mock.calls[1][1].method).toEqual('POST');

    expect(fetchMock.mock.calls[2][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main/schema/apply');
    expect(fetchMock.mock.calls[2][1].method).toEqual('POST');
  });

  test('uploads a schema, with create-only, and operations are ignored', async () => {
    const config = await Config.load();
    const command = new UploadSchema(['file.json', '--yes', '--create-only'], config);

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async () => ({
        schema: mockSchema
      })
    });

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async (): Promise<Responses.SchemaCompareResponse> => ({
        source: mockSchema,
        target: mockSchema,
        edits: { operations: [{ addColumn: { table: 'users', column: { name: 'age', type: 'int' as const } } }] }
      })
    });

    fetchMock.mockReturnValueOnce({
      ok: true,
      json: async () => ({})
    });

    const readFile = vi.spyOn(fs, 'readFile');

    readFile.mockReturnValue(Promise.resolve(JSON.stringify(mockSchema)));

    await command.run();

    expect(readFile).not.toHaveBeenCalled();

    expect(fetchMock.mock.calls.length).toEqual(1);

    expect(fetchMock.mock.calls[0][0]).toEqual('https://mock.eu-west-1.xata.sh/db/xata:main');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });
});
