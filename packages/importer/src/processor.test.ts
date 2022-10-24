import { Schemas, XataApiClient } from '@xata.io/client';
import { describe, expect, test, vi } from 'vitest';
import { compareSchema, createProcessor, TableInfo } from './processor';

describe('compareSquema', () => {
  test('returns a missing table', () => {
    const diff = compareSchema(['a', 'b', 'c'], ['string', 'int', 'float'], undefined);
    expect(diff).toMatchInlineSnapshot(`
      {
        "columnTypes": [
          {
            "columnName": "a",
            "schemaType": "string",
          },
          {
            "columnName": "b",
            "schemaType": "int",
          },
          {
            "columnName": "c",
            "schemaType": "float",
          },
        ],
        "missingColumns": [
          {
            "column": "a",
            "type": "string",
          },
          {
            "column": "b",
            "type": "int",
          },
          {
            "column": "c",
            "type": "float",
          },
        ],
        "missingTable": true,
      }
    `);
  });

  test('returns missing columns', () => {
    const table: Schemas.Table = {
      name: 'foo',
      columns: [
        {
          name: 'c',
          type: 'float'
        }
      ]
    };
    const diff = compareSchema(['a', 'b', 'c'], ['string', 'int', 'float'], table);
    expect(diff).toMatchInlineSnapshot(`
      {
        "columnTypes": [
          {
            "castedType": "string",
            "columnName": "a",
            "error": false,
            "guessedType": "string",
            "schemaType": "string",
          },
          {
            "castedType": "int",
            "columnName": "b",
            "error": false,
            "guessedType": "int",
            "schemaType": "int",
          },
          {
            "castedType": "float",
            "columnName": "c",
            "error": false,
            "guessedType": "float",
            "schemaType": "float",
          },
        ],
        "missingColumns": [
          {
            "column": "a",
            "type": "string",
          },
          {
            "column": "b",
            "type": "int",
          },
        ],
        "missingTable": false,
      }
    `);
  });

  test('casts string as float and tries to parse it', () => {
    const table: Schemas.Table = {
      name: 'foo',
      columns: [
        {
          name: 'c',
          type: 'float'
        }
      ]
    };
    const diff = compareSchema(['a', 'b', 'c'], ['string', 'int', 'string'], table);
    expect(diff).toMatchInlineSnapshot(`
      {
        "columnTypes": [
          {
            "castedType": "string",
            "columnName": "a",
            "error": false,
            "guessedType": "string",
            "schemaType": "string",
          },
          {
            "castedType": "int",
            "columnName": "b",
            "error": false,
            "guessedType": "int",
            "schemaType": "int",
          },
          {
            "castedType": "float",
            "columnName": "c",
            "error": false,
            "guessedType": "string",
            "schemaType": "float",
          },
        ],
        "missingColumns": [
          {
            "column": "a",
            "type": "string",
          },
          {
            "column": "b",
            "type": "int",
          },
        ],
        "missingTable": false,
      }
    `);
  });
});

const dumbTableInfo: TableInfo = {
  branch: 'main',
  database: 'test',
  table: 'foo',
  workspace: 'test-1234',
  region: 'us-east-1'
};

describe('createProcessor', () => {
  test('fails when the number of types and columns does not match', () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: 'anything' });
    const shouldContinue = vi.fn();

    expect(() => createProcessor(xata, dumbTableInfo, { shouldContinue, types: [], columns: ['a'] })).toThrowError(
      'Different number of column names and column types'
    );
    expect(shouldContinue).not.toHaveBeenCalled();
  });

  test('needs to receive a header or receive specific column names', async () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: 'anything' });
    const shouldContinue = vi.fn();

    const { callback } = createProcessor(xata, dumbTableInfo, { shouldContinue });
    await expect(callback([[]], [], 1)).rejects.toEqual(
      new Error(
        'Cannot calculate column names. A file header was not specified and no custom columns were specified either'
      )
    );
  });

  test('calls shuldContinue and stops the parsing if it returns false', async () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: 'anything' });
    const shouldContinue = vi.fn().mockImplementation(() => false);

    Object.defineProperty(xata, 'branches', {
      get() {
        return {
          getBranchDetails: async () => {
            return { schema: { tables: [] } };
          }
        };
      }
    });

    const { callback } = createProcessor(xata, dumbTableInfo, { shouldContinue, columns: ['a'] });
    await callback([['foo']], ['a'], 1);

    expect(shouldContinue).toHaveBeenCalled();
  });

  test('calls shuldContinue, continues, creates a table and inserts the records', async () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: 'anything' });
    const shouldContinue = vi.fn().mockImplementation(() => true);

    // Mock branches API
    Object.defineProperty(xata, 'branches', {
      get() {
        return {
          getBranchDetails: async () => {
            return { schema: { tables: [] } };
          }
        };
      }
    });

    // Mock tables API
    const createTable = vi.fn();
    const addTableColumn = vi.fn();
    Object.defineProperty(xata, 'tables', {
      get() {
        return {
          createTable,
          addTableColumn
        };
      }
    });

    // Mock records API
    const bulkInsertTableRecords = vi.fn();
    Object.defineProperty(xata, 'records', {
      get() {
        return {
          bulkInsertTableRecords
        };
      }
    });

    const { callback } = createProcessor(xata, dumbTableInfo, { shouldContinue });

    // We also test here that column names are normalized
    await callback([['foo']], [' 你好. buenos días '], 1);

    expect(shouldContinue).toHaveBeenCalled();
    expect(createTable).toHaveBeenCalledWith({
      workspace: 'test-1234',
      region: 'us-east-1',
      database: 'test',
      branch: 'main',
      table: 'foo'
    });
    expect(addTableColumn).toHaveBeenCalledWith({
      workspace: 'test-1234',
      region: 'us-east-1',
      database: 'test',
      branch: 'main',
      table: 'foo',
      column: {
        name: 'niHao.buenosDias',
        type: 'string'
      }
    });

    expect(bulkInsertTableRecords).toHaveBeenCalledWith({
      workspace: 'test-1234',
      region: 'us-east-1',
      database: 'test',
      branch: 'main',
      table: 'foo',
      records: [{ ['niHao.buenosDias']: 'foo' }]
    });
  });

  test('calls shuldContinue, continues, updates a table and inserts the records', async () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: 'anything' });
    const shouldContinue = vi.fn().mockImplementation(() => true);

    // Mock branches API
    Object.defineProperty(xata, 'branches', {
      get() {
        return {
          getBranchDetails: async () => {
            return { schema: { tables: [{ name: 'foo', columns: [] }] } };
          }
        };
      }
    });

    // Mock tables API
    const createTable = vi.fn();
    const addTableColumn = vi.fn();
    Object.defineProperty(xata, 'tables', {
      get() {
        return {
          createTable,
          addTableColumn
        };
      }
    });

    // Mock records API
    const bulkInsertTableRecords = vi.fn();
    Object.defineProperty(xata, 'records', {
      get() {
        return {
          bulkInsertTableRecords
        };
      }
    });

    const { callback } = createProcessor(xata, dumbTableInfo, { shouldContinue, columns: ['a'] });
    await callback([['1']], ['a'], 1);

    expect(shouldContinue).toHaveBeenCalled();
    expect(createTable).not.toHaveBeenCalled();
    expect(addTableColumn).toHaveBeenCalledWith({
      workspace: 'test-1234',
      region: 'us-east-1',
      database: 'test',
      branch: 'main',
      table: 'foo',
      column: { name: 'a', type: 'int' }
    });

    expect(bulkInsertTableRecords).toHaveBeenCalledWith({
      workspace: 'test-1234',
      region: 'us-east-1',
      database: 'test',
      branch: 'main',
      table: 'foo',
      records: [{ a: 1 }]
    });
  });
});
