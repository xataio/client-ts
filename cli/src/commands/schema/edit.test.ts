import { beforeEach, expect, test, describe } from 'vitest';
import {
  AddColumnPayload,
  AddTablePayload,
  ColumnAdditionData,
  ColumnData,
  ColumnEditData,
  DeleteColumnPayload,
  DeleteTablePayload,
  EditTablePayload
} from './types';
import { PgRollMigration } from '@xata.io/pgroll';
import EditSchema, { editsToMigrations } from './edit';

class mockEdit {
  tableAdditions: AddTablePayload['table'][] = [];
  tableEdits: EditTablePayload['table'][] = [];
  tableDeletions: DeleteTablePayload[] = [];
  columnAdditions: ColumnAdditionData = {};
  columnEdits: ColumnEditData = {};
  columnDeletions: DeleteColumnPayload = {};
  currentMigration: PgRollMigration = { operations: [] };
}

const editCommand = new mockEdit();

beforeEach(() => {
  editCommand.tableAdditions = [];
  editCommand.tableEdits = [];
  editCommand.tableDeletions = [];
  editCommand.columnAdditions = {};
  editCommand.columnEdits = {};
  editCommand.columnDeletions = {};
  editCommand.currentMigration = { operations: [] };
});

const createAddition = (column: ColumnData) => {
  if (!editCommand.columnAdditions[column.tableName]) editCommand.columnAdditions[column.tableName] = {};
  if (!editCommand.columnAdditions[column.tableName][column.originalName])
    editCommand.columnAdditions[column.tableName][column.originalName] = {} as any;
  editCommand.columnAdditions[column.tableName][column.originalName] = column;
};

const createEdit = (column: ColumnData) => {
  if (!editCommand.columnEdits[column.tableName]) editCommand.columnEdits[column.tableName] = {};
  if (!editCommand.columnEdits[column.tableName][column.originalName])
    editCommand.columnEdits[column.tableName][column.originalName] = {} as any;
  editCommand.columnEdits[column.tableName][column.originalName] = column;
};

const column: AddColumnPayload['column'] = {
  name: 'col1',
  defaultValue: undefined,
  link: undefined,
  type: 'string',
  unique: false,
  nullable: true,
  originalName: 'col1',
  tableName: 'table1'
};

const runTest = (name: string, fx: () => void, expectation: any) => {
  test(name, () => {
    fx();
    editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
    expect(editCommand.currentMigration.operations).toEqual(expectation);
  });
};

type TestCase = {
  name: string;
  fx: () => void;
  expectation: any;
  only?: boolean;
};

const testCases: TestCase[] = [
  {
    name: 'add table',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
    },
    expectation: [{ create_table: { name: 'table1', columns: [] } }]
  },
  {
    name: 'delete table',
    fx: () => {
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: [{ drop_table: { name: 'table1' } }]
  },
  {
    name: 'edit table',
    fx: () => {
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
    },
    expectation: [{ rename_table: { from: 'table1', to: 'table2' } }]
  },
  {
    name: 'add column',
    fx: () => {
      createAddition(column);
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            type: 'text',
            nullable: true,
            unique: false,
            check: {
              constraint: 'LENGTH("col1") <= 2048',
              name: 'table1_xata_string_length_col1'
            },
            up: undefined,
            comment: '{"xata.type":"string"}',
            default: undefined,
            references: undefined
          }
        }
      }
    ]
  },
  {
    name: 'add column default',
    fx: () => {
      createAddition({
        ...column,
        type: 'int',
        defaultValue: '10000'
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            type: 'bigint',
            references: undefined,
            default: "'10000'",
            nullable: true,
            unique: false
          }
        }
      }
    ]
  },
  {
    name: 'add column not null',
    fx: () => {
      createAddition({
        ...column,
        type: 'int',
        nullable: false
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            type: 'bigint',
            references: undefined,
            up: '0',
            nullable: false,
            unique: false
          }
        }
      }
    ]
  },
  {
    name: 'add column unique',
    fx: () => {
      createAddition({
        ...column,
        type: 'int',
        unique: true
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            type: 'bigint',
            references: undefined,
            up: undefined,
            nullable: true,
            unique: true
          }
        }
      }
    ]
  },
  {
    name: 'add column file',
    fx: () => {
      createAddition({
        ...column,
        type: 'file',
        file: {
          defaultPublicAccess: false
        }
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            comment: '{"xata.file.dpa":false}',
            type: 'xata.xata_file',
            references: undefined,
            up: undefined,
            nullable: true,
            unique: false
          }
        }
      }
    ]
  },
  {
    name: 'add column file[]',
    fx: () => {
      createAddition({
        ...column,
        type: 'file[]',
        'file[]': {
          defaultPublicAccess: true
        }
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            comment: '{"xata.file.dpa":true}',
            type: 'xata.xata_file_array',
            references: undefined,
            up: undefined,
            nullable: true,
            unique: false
          }
        }
      }
    ]
  },
  {
    name: 'add column vector',
    fx: () => {
      createAddition({
        ...column,
        type: 'vector',
        vector: {
          dimension: 10
        }
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            check: {
              constraint: 'ARRAY_LENGTH("col1", 1) = 10',
              name: 'table1_xata_vector_length_col1'
            },
            type: 'real[]',
            nullable: true,
            unique: false,
            comment: '{"xata.search.dimension":10}',
            references: undefined,
            up: undefined,
            default: undefined
          }
        }
      }
    ]
  },
  {
    name: 'add link column',
    fx: () => {
      createAddition({
        ...column,
        type: 'link',
        link: { table: 'table2' }
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col1',
            type: 'text',
            nullable: true,
            unique: false,
            comment: '{"xata.link":"table2"}',
            references: {
              column: 'xata_id',
              name: 'col1_link',
              on_delete: 'SET NULL',
              table: 'table2'
            },
            default: undefined,
            up: undefined
          }
        }
      }
    ]
  },
  {
    name: 'edit column',
    fx: () => {
      createEdit({
        ...column,
        name: 'col2'
      });
    },
    expectation: [
      {
        alter_column: {
          name: 'col2',
          column: 'col1',
          nullable: true,
          table: 'table1',
          // Todo fix this. alter_column should not be boolean
          unique: undefined,
          down: '"col2"',
          up: '"col2"'
        }
      }
    ]
  },
  {
    name: 'edit column nullable to not nullable',
    fx: () => {
      createEdit({
        ...column,
        nullable: false
      });
    },
    expectation: [
      {
        alter_column: {
          name: 'col1',
          column: 'col1',
          nullable: false,
          table: 'table1',
          unique: undefined,
          down: '"col1"',
          up: '"col1"'
        }
      }
    ]
  },
  {
    name: 'edit column not unique to unique',
    fx: () => {
      createEdit({
        ...column,
        unique: true
      });
    },
    expectation: [
      {
        alter_column: {
          // todo name should not be in here
          name: 'col1',
          column: 'col1',
          // todo nullable should not be in here
          nullable: true,
          down: '"col1"',
          up: '"col1"',
          table: 'table1',
          unique: {
            name: 'unique_constraint_table1_col1'
          }
        }
      }
    ]
  },
  {
    name: 'deleting an existing table deletes all table edits',
    fx: () => {
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: [{ drop_table: { name: 'table1' } }]
  },
  {
    name: 'deleting an existing table deletes all column edits',
    fx: () => {
      createEdit({
        ...column,
        name: 'col2'
      });
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: [{ drop_table: { name: 'table1' } }]
  },
  {
    name: 'deleting an existing table deletes all column deletes',
    fx: () => {
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: [{ drop_table: { name: 'table1' } }]
  },
  {
    name: 'deleting an existing table deletes all column additions',
    fx: () => {
      createAddition(column);
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: [{ drop_table: { name: 'table1' } }]
  },
  {
    name: 'creating a new column and deleting an existing table',
    fx: () => {
      createAddition(column);
      editCommand.columnDeletions['table1'] = ['col1'];
      createAddition({
        ...column,
        originalName: 'col2',
        name: 'col2'
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col2',
            type: 'text',
            nullable: true,
            unique: false,
            check: {
              constraint: 'LENGTH("col2") <= 2048',
              name: 'table1_xata_string_length_col2'
            },
            comment: '{"xata.type":"string"}',
            default: undefined,
            references: undefined,
            up: undefined
          }
        }
      }
    ]
  },
  {
    name: 'deleting an existing column deletes all column edits',
    fx: () => {
      createEdit({
        ...column,
        name: 'col2'
      });
      editCommand.columnDeletions['table1'] = ['col1'];
    },
    expectation: [
      {
        drop_column: {
          column: 'col1',
          table: 'table1'
        }
      }
    ]
  },

  {
    name: 'deleting a new table deletes all table edits',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: []
  },
  {
    name: 'deleting a new table deletes all column edits',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      createEdit({
        ...column,
        name: 'col2'
      });
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: []
  },

  {
    name: 'deleting a new table deletes all column deletes',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: []
  },

  {
    name: 'deleting a new table deletes all column additions',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      createAddition(column);
      editCommand.tableDeletions.push({ name: 'table1' });
    },
    expectation: []
  },
  {
    name: 'editing a new table is bundled with the table addition',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
    },
    expectation: [
      {
        create_table: { name: 'table2', columns: [] }
      }
    ]
  },
  {
    name: 'editing a new table removes the table edit',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
    },
    expectation: [
      {
        create_table: { name: 'table2', columns: [] }
      }
    ]
  },
  {
    name: 'adding a column on a new table with unique = false is sent correctly',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      createAddition({
        ...column,
        type: 'float',
        unique: true
      });
    },
    expectation: [
      {
        create_table: {
          name: 'table1',
          columns: [
            {
              name: 'col1',
              type: 'double precision',
              nullable: true,
              unique: true,
              default: undefined,
              references: undefined,
              up: undefined
            }
          ]
        }
      }
    ]
  },
  {
    name: 'adding a column on a new table with nullable = false is sent correctly',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      createAddition({
        ...column,
        type: 'float',
        nullable: false
      });
    },
    expectation: [
      {
        create_table: {
          name: 'table1',
          columns: [
            {
              name: 'col1',
              type: 'double precision',
              nullable: false,
              unique: false,
              default: undefined,
              references: undefined,
              up: '0'
            }
          ]
        }
      }
    ]
  },
  {
    name: 'adding a column on a new table with nullable = false is sent correctly',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      createAddition({
        ...column,
        type: 'float',
        nullable: false
      });
    },
    expectation: [
      {
        create_table: {
          name: 'table1',
          columns: [
            {
              name: 'col1',
              type: 'double precision',
              nullable: false,
              unique: false,
              default: undefined,
              references: undefined,
              up: '0'
            }
          ]
        }
      }
    ]
  },
  {
    name: 'adding a column on a new table with nullable = true is sent correctly',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      createAddition({
        ...column,
        type: 'float',
        nullable: true
      });
    },
    expectation: [
      {
        create_table: {
          name: 'table1',
          columns: [
            {
              name: 'col1',
              type: 'double precision',
              nullable: true,
              unique: false,
              default: undefined,
              references: undefined,
              up: undefined
            }
          ]
        }
      }
    ]
  },
  {
    name: 'deleting a new column deletes all column additions, edit and deletions',
    fx: () => {
      createAddition(column);
      createEdit({
        ...column,
        name: 'col2'
      });
      editCommand.columnDeletions['table1'] = ['col1'];
    },
    expectation: []
  },
  {
    name: 'deleting a newly created column does not remove other deletes',
    fx: () => {
      editCommand.columnDeletions['table1'] = ['col1'];
      createAddition({
        ...column,
        originalName: 'col2',
        name: 'col3',
        type: 'float'
      });
      editCommand.columnDeletions['table1'].push('col2');
    },
    expectation: [
      {
        drop_column: {
          column: 'col1',
          table: 'table1'
        }
      }
    ]
  },
  {
    name: 'adding a newly created column and making edit',
    fx: () => {
      createAddition({
        ...column,
        type: 'float'
      });
      createEdit({
        ...column,
        type: 'float',
        name: 'col5',
        nullable: false,
        unique: true
      });
      createEdit({
        ...column,
        type: 'float',
        name: 'col6',
        nullable: false,
        unique: true
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col6',
            type: 'double precision',
            nullable: false,
            unique: true,
            default: undefined,
            references: undefined,
            up: '0'
          }
        }
      }
    ]
  },
  {
    name: 'editing a new column in an existing table removes the column edit, and gets sent in add_column',
    fx: () => {
      createAddition(column);
      createEdit({
        ...column,
        name: 'col2'
      });
    },
    expectation: [
      {
        add_column: {
          table: 'table1',
          column: {
            name: 'col2',
            type: 'text',
            nullable: true,
            unique: false,
            check: {
              constraint: 'LENGTH("col2") <= 2048',
              name: 'table1_xata_string_length_col2'
            },
            comment: '{"xata.type":"string"}',
            default: undefined,
            references: undefined,
            up: undefined
          }
        }
      }
    ]
  },
  {
    name: 'deleting a new column deletes all column additions, edits, and deletions',
    fx: () => {
      createAddition(column);
      createEdit({
        ...column,
        name: 'col2'
      });
      editCommand.columnDeletions['table1'] = ['col1'];
    },
    expectation: []
  },
  {
    name: 'editing a new column in a new table removes the column edit',
    fx: () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      createAddition(column);
      createAddition({
        ...column,
        name: 'col8',
        originalName: 'col8'
      });
      createEdit({
        ...column,
        name: 'col2'
      });
      createEdit({
        ...column,
        name: 'col3'
      });
    },
    expectation: [
      {
        create_table: {
          name: 'table1',
          columns: [
            {
              name: 'col3',
              type: 'text',
              nullable: true,
              unique: false,
              check: {
                constraint: 'LENGTH("col3") <= 2048',
                name: 'table1_xata_string_length_col3'
              },
              comment: '{"xata.type":"string"}',
              default: undefined,
              references: undefined
            },
            {
              name: 'col8',
              type: 'text',
              nullable: true,
              unique: false,
              check: {
                constraint: 'LENGTH("col8") <= 2048',
                name: 'table1_xata_string_length_col8'
              },
              comment: '{"xata.type":"string"}',
              default: undefined,
              references: undefined,
              up: undefined
            }
          ]
        }
      }
    ]
  }
];

describe('edits to migrations', () => {
  const testWithOnly = testCases.some(({ only }) => only);
  testWithOnly
    ? testCases.filter(({ only }) => only).forEach(({ name, fx, expectation }) => runTest(name, fx, expectation))
    : null;
  !testWithOnly ? testCases.forEach(({ name, fx, expectation }) => runTest(name, fx, expectation)) : null;
});
