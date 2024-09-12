import { describe, expect, test } from 'vitest';
import { splitCommas } from './csv';
import { compareSchemas } from '../../utils/compareSchema';
import { Schemas } from '@xata.io/client';

const sourceSchemaDefault: Schemas.BranchSchema = {
  name: 'main',
  tables: {
    one: {
      name: 'one',
      xataCompatible: true,
      comment: '',
      primaryKey: ['id'],
      uniqueConstraints: {},
      checkConstraints: {},
      foreignKeys: {},
      indexes: {},
      oid: '',
      columns: {
        id: {
          name: 'id',
          type: 'integer',
          comment: '',
          nullable: false,
          unique: true,
          default: null
        },
        colToDelete: {
          name: 'colToDelete',
          type: 'text',
          comment: '',
          nullable: false,
          unique: false,
          default: null
        }
      }
    }
  }
};

const targetSchemaDefault: Schemas.BranchSchema = {
  name: 'main',
  tables: {
    one: {
      name: 'one',
      xataCompatible: true,
      comment: '',
      primaryKey: ['id'],
      uniqueConstraints: {},
      checkConstraints: {},
      foreignKeys: {},
      indexes: {},
      oid: '',
      columns: {
        id: {
          name: 'id',
          type: 'integer',
          comment: '',
          nullable: false,
          unique: true,
          default: null
        },
        newCol: {
          name: 'newCol',
          type: 'text',
          comment: '',
          nullable: false,
          unique: false,
          default: null
        }
      }
    }
  }
};

describe('splitCommas', () => {
  test('returns [] for falsy values', () => {
    expect(splitCommas(null)).toEqual([]);
    expect(splitCommas('')).toEqual([]);
    expect(splitCommas(false)).toEqual([]);
    expect(splitCommas(undefined)).toEqual([]);
  });

  test('returns an array with the comma separated values', () => {
    expect(splitCommas('a,b,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('compare schemas', () => {
  test('returns an empty array for identical schemas', () => {
    const { edits } = compareSchemas({ source: sourceSchemaDefault, target: sourceSchemaDefault });
    expect(edits).toEqual([]);
  });
  test('ignores internal columns on source', () => {
    const { edits } = compareSchemas({
      source: {
        ...sourceSchemaDefault,
        tables: {
          ...sourceSchemaDefault.tables,
          one: {
            ...sourceSchemaDefault.tables.one,
            columns: {
              ...sourceSchemaDefault.tables.one.columns,
              xata_id: {
                name: 'xata_id',
                type: 'text',
                comment: '',
                nullable: false,
                unique: false,
                default: null
              }
            }
          }
        }
      },
      target: targetSchemaDefault
    });
    expect(edits).toMatchInlineSnapshot(compareSnapshot);
  });
  test('ignores internal columns on target', () => {
    const { edits } = compareSchemas({
      source: sourceSchemaDefault,
      target: {
        ...targetSchemaDefault,
        tables: {
          ...targetSchemaDefault.tables,
          one: {
            ...targetSchemaDefault.tables.one,
            columns: {
              ...targetSchemaDefault.tables.one.columns,
              xata_id: {
                name: 'xata_id',
                type: 'text',
                comment: '',
                nullable: false,
                unique: false,
                default: null
              }
            }
          }
        }
      }
    });
    expect(edits).toMatchInlineSnapshot(compareSnapshot);
  });
  test('returns an array with add_column for new columns', () => {
    const { edits } = compareSchemas({ source: sourceSchemaDefault, target: targetSchemaDefault });
    expect(edits).toMatchInlineSnapshot(compareSnapshot);
  });
  test('returns an array with drop_column for deleted columns', () => {
    const { edits } = compareSchemas({ source: sourceSchemaDefault, target: targetSchemaDefault });
    expect(edits).toMatchInlineSnapshot(compareSnapshot);
  });
});

const compareSnapshot = `
[
  {
    "add_column": {
      "column": {
        "comment": "",
        "default": undefined,
        "name": "newCol",
        "nullable": false,
        "references": undefined,
        "type": "text",
        "unique": false,
      },
      "table": "one",
    },
  },
  {
    "drop_column": {
      "column": "colToDelete",
      "table": "one",
    },
  },
]`;
