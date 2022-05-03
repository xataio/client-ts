import { XataApiClient } from '@xata.io/client';
import { Table } from '@xata.io/client/dist/api/schemas';
import { compareSquema, createProcessor, TableInfo } from './processor.js';

describe('compareSquema', () => {
  test('returns a missing table', () => {
    const diff = compareSquema(['a', 'b', 'c'], ['string', 'int', 'float'], undefined);
    expect(diff).toMatchInlineSnapshot(`
      Object {
        "columnTypes": Array [
          Object {
            "columnName": "a",
            "schemaType": "string",
          },
          Object {
            "columnName": "b",
            "schemaType": "int",
          },
          Object {
            "columnName": "c",
            "schemaType": "float",
          },
        ],
        "missingColumns": Array [
          Object {
            "column": "a",
            "type": "string",
          },
          Object {
            "column": "b",
            "type": "int",
          },
          Object {
            "column": "c",
            "type": "float",
          },
        ],
        "missingTable": true,
      }
    `);
  });

  test('returns missing columns', () => {
    const table: Table = {
      name: 'foo',
      columns: [
        {
          name: 'c',
          type: 'float'
        }
      ]
    };
    const diff = compareSquema(['a', 'b', 'c'], ['string', 'int', 'float'], table);
    expect(diff).toMatchInlineSnapshot(`
      Object {
        "columnTypes": Array [
          Object {
            "castedType": "string",
            "columnName": "a",
            "error": false,
            "guessedType": "string",
            "schemaType": "string",
          },
          Object {
            "castedType": "int",
            "columnName": "b",
            "error": false,
            "guessedType": "int",
            "schemaType": "int",
          },
          Object {
            "castedType": "string",
            "columnName": "c",
            "error": true,
            "guessedType": "float",
            "schemaType": "float",
          },
        ],
        "missingColumns": Array [
          Object {
            "column": "a",
            "type": "string",
          },
          Object {
            "column": "b",
            "type": "int",
          },
        ],
        "missingTable": false,
      }
    `);
  });

  test('returns incompatible types', () => {
    const table: Table = {
      name: 'foo',
      columns: [
        {
          name: 'c',
          type: 'float'
        }
      ]
    };
    const diff = compareSquema(['a', 'b', 'c'], ['string', 'int', 'string'], table);
    expect(diff).toMatchInlineSnapshot(`
      Object {
        "columnTypes": Array [
          Object {
            "castedType": "string",
            "columnName": "a",
            "error": false,
            "guessedType": "string",
            "schemaType": "string",
          },
          Object {
            "castedType": "int",
            "columnName": "b",
            "error": false,
            "guessedType": "int",
            "schemaType": "int",
          },
          Object {
            "castedType": "string",
            "columnName": "c",
            "error": true,
            "guessedType": "string",
            "schemaType": "float",
          },
        ],
        "missingColumns": Array [
          Object {
            "column": "a",
            "type": "string",
          },
          Object {
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
  tableName: 'foo',
  workspaceID: 'test-1234'
};

describe('createProcessor', () => {
  test('fails when the number of types and columns does not match', () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: '' });
    const shouldContinue = jest.fn();

    expect(() => createProcessor(xata, dumbTableInfo, { shouldContinue, types: [], columns: ['a'] })).toThrowError(
      'Different number of column names and column types'
    );
    expect(shouldContinue).not.toHaveBeenCalled();
  });

  test('needs to receive a header or receive specific column names', async () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: '' });
    const shouldContinue = jest.fn();

    const { callback } = createProcessor(xata, dumbTableInfo, { shouldContinue });
    await expect(callback([[]], [], 1)).rejects.toEqual(
      new Error(
        'Cannot calculate column names. A file header was not specified and no custom columns were specified either'
      )
    );
  });

  test('calls shuldContinue and stops the parsing if it returns false', async () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: '' });
    const shouldContinue = jest.fn().mockImplementation(() => false);

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
    const xata = new XataApiClient({ fetch: {} as any, apiKey: '' });
    const shouldContinue = jest.fn().mockImplementation(() => true);

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
    const createTable = jest.fn();
    const addTableColumn = jest.fn();
    Object.defineProperty(xata, 'tables', {
      get() {
        return {
          createTable,
          addTableColumn
        };
      }
    });

    // Mock records API
    const bulkInsertTableRecords = jest.fn();
    Object.defineProperty(xata, 'records', {
      get() {
        return {
          bulkInsertTableRecords
        };
      }
    });

    const { callback } = createProcessor(xata, dumbTableInfo, { shouldContinue, columns: ['a'] });
    await callback([['foo']], ['a'], 1);

    expect(shouldContinue).toHaveBeenCalled();
    expect(createTable).toHaveBeenCalledWith('test-1234', 'test', 'main', 'foo');
    expect(addTableColumn).toHaveBeenCalledWith('test-1234', 'test', 'main', 'foo', { name: 'a', type: 'string' });

    expect(bulkInsertTableRecords).toHaveBeenCalledWith('test-1234', 'test', 'main', 'foo', [{ a: 'foo' }]);
  });

  test('calls shuldContinue, continues, updates a table and inserts the records', async () => {
    const xata = new XataApiClient({ fetch: {} as any, apiKey: '' });
    const shouldContinue = jest.fn().mockImplementation(() => true);

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
    const createTable = jest.fn();
    const addTableColumn = jest.fn();
    Object.defineProperty(xata, 'tables', {
      get() {
        return {
          createTable,
          addTableColumn
        };
      }
    });

    // Mock records API
    const bulkInsertTableRecords = jest.fn();
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
    expect(addTableColumn).toHaveBeenCalledWith('test-1234', 'test', 'main', 'foo', { name: 'a', type: 'int' });

    expect(bulkInsertTableRecords).toHaveBeenCalledWith('test-1234', 'test', 'main', 'foo', [{ a: 1 }]);
  });
});
