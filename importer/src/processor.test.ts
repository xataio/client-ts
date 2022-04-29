import { compareSquema } from './processor.js';
import { Table } from '@xata.io/client/dist/api/schemas';

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
