import { beforeEach, expect, test, describe } from 'vitest';
import {
  AddColumnPayload,
  AddTablePayload,
  DeleteColumnPayload,
  DeleteTablePayload,
  EditColumnPayload,
  EditTablePayload
} from './types';
import { PgRollMigration } from '@xata.io/pgroll';
import EditSchema, { editsToMigrations } from './edit';

class mockEdit {
  tableAdditions: AddTablePayload['table'][] = [];
  tableEdits: EditTablePayload['table'][] = [];
  tableDeletions: DeleteTablePayload[] = [];
  columnAdditions: AddColumnPayload['column'][] = [];
  columnEdits: EditColumnPayload['column'][] = [];
  columnDeletions: DeleteColumnPayload = {};
  currentMigration: PgRollMigration = { operations: [] };
}

const editCommand = new mockEdit();

beforeEach(() => {
  editCommand.tableAdditions = [];
  editCommand.tableEdits = [];
  editCommand.tableDeletions = [];
  editCommand.columnAdditions = [];
  editCommand.columnEdits = [];
  editCommand.columnDeletions = {};
  editCommand.currentMigration = { operations: [] };
});

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

describe('edits to migrations', () => {
  describe('single edits to existing entities', () => {
    test('add table', () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ create_table: { name: 'table1', columns: [] } }]);
    });

    test('delete table', () => {
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ drop_table: { name: 'table1' } }]);
    });

    test('edit table', () => {
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ rename_table: { from: 'table1', to: 'table2' } }]);
    });

    test('add column', () => {
      editCommand.columnAdditions.push(column);
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
    test('add column default', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'int',
        defaultValue: '10000'
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
    test('add column not null', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'int',
        nullable: false
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
    test('add column unique', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'int',
        unique: true
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
    test('add column file', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'file',
        file: {
          defaultPublicAccess: false
        }
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
    test('add column file[]', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'file[]',
        'file[]': {
          defaultPublicAccess: true
        }
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
    test('add column vector', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'vector',
        vector: {
          dimension: 10
        }
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
    test('add link column', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'link',
        link: { table: 'table2' }
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });

    test('edit column', () => {
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });

    test('edit column nullable to not nullable', () => {
      editCommand.columnEdits.push({
        ...column,
        nullable: false
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          alter_column: {
            // todo name should not be in here
            name: 'col1',
            column: 'col1',
            nullable: false,
            table: 'table1',
            unique: undefined,
            down: '"col1"',
            up: '"col1"'
          }
        }
      ]);
    });

    test('edit column not unique to unique', () => {
      editCommand.columnEdits.push({
        ...column,
        unique: true
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          alter_column: {
            // todo name should not be in here
            name: 'col1',
            column: 'col1',
            // todo nullable should not be in here
            nullable: true,
            table: 'table1',
            unique: {
              name: 'unique_constraint_table1_col1'
            },
            down: '"col1"',
            up: '"col1"'
          }
        }
      ]);
    });

    test('delete column', () => {
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          drop_column: {
            column: 'col1',
            table: 'table1'
          }
        }
      ]);
    });
  });

  describe('multiple edits to existing entities', () => {
    test('deleting an existing table deletes all table edits', () => {
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ drop_table: { name: 'table1' } }]);
    });
    test('deleting an existing table deletes all column edits', () => {
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ drop_table: { name: 'table1' } }]);
    });
    test('deleting an existing table deletes all column deletes', () => {
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ drop_table: { name: 'table1' } }]);
    });
    test('deleting an existing table deletes all column additions', () => {
      editCommand.columnAdditions.push(column);
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ drop_table: { name: 'table1' } }]);
    });

    test('creating a new column and deleting an existing table', () => {
      editCommand.columnAdditions.push(column);
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.columnAdditions.push({
        ...column,
        originalName: 'col2',
        name: 'col2'
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });

    test('deleting an existing column deletes all column edits', () => {
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          drop_column: {
            column: 'col1',
            table: 'table1'
          }
        }
      ]);
    });
  });

  describe('new tables', () => {
    test('deleting a new table deletes all table edits', () => {
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          drop_table: { name: 'table1' }
        }
      ]);
    });
    test('deleting a new table deletes all column edits', () => {
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          drop_table: { name: 'table1' }
        }
      ]);
    });
    test('deleting a new table deletes all column deletes', () => {
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          drop_table: { name: 'table1' }
        }
      ]);
    });
    test('deleting a new table deletes all column additions', () => {
      editCommand.columnAdditions.push(column);
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          drop_table: { name: 'table1' }
        }
      ]);
    });
    test('editing a new table is bundled with the table addition', () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          create_table: { name: 'table2', columns: [] }
        }
      ]);
    });
    test('editing a new table removes the table edit', () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.tableEdits.push({ name: 'table1', newName: 'table2' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          create_table: { name: 'table2', columns: [] }
        }
      ]);
    });
  });

  describe('existing tables with new columns', () => {
    test('deleting a new column deletes all column additions, edit and deletions', () => {
      editCommand.columnAdditions.push(column);
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([]);
    });
    test('deleting a newly created column does not remove other deletes', () => {
      // delete column
      // add new column
      // delete new column
      // make sure delete to old column is still present
    });
    // todo unique test
    test('adding a newly created column and making edit', () => {
      editCommand.columnAdditions.push({
        ...column,
        type: 'float'
      });
      editCommand.columnEdits.push({
        ...column,
        name: 'col5',
        nullable: false,
        unique: true
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          add_column: {
            table: 'table1',
            column: {
              name: 'col5',
              type: 'double precision',
              nullable: false,
              unique: true,
              default: undefined,
              references: undefined,
              up: '0'
            }
          }
        }
      ]);
    });
    test('editing a new column in an existing table removes the column edit, and gets sent in add_column', () => {
      editCommand.columnAdditions.push(column);
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
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
      ]);
    });
  });

  describe('new tables with new columns', () => {
    test('deleting a new column deletes all column additions, edits, and deletions', () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.columnAdditions.push(column);
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          create_table: {
            name: 'table1',
            columns: []
          }
        }
      ]);
    });
    test('editing a new column in a new table removes the column edit', () => {
      editCommand.tableAdditions.push({ name: 'table1' });
      editCommand.columnAdditions.push(column);
      editCommand.columnEdits.push({
        ...column,
        name: 'col2'
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          create_table: {
            name: 'table1',
            columns: [
              {
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
                references: undefined
              }
            ]
          }
        }
      ]);
    });
  });
});
