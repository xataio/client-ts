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
      // todo some more types of additions
      editCommand.columnAdditions.push({
        name: 'col1',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          add_column: {
            table: 'table1',
            column: {
              name: 'col1',
              type: 'text',
              nullable: false,
              unique: false,
              check: {
                constraint: 'LENGTH("col1") <= 2048',
                name: 'table1_xata_string_length_col1'
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

    test('edit column', () => {
      // todo correct this
      // add different types of payloads
      editCommand.columnEdits.push({
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          alter_column: {
            name: 'col2',
            column: 'col1',
            nullable: false,
            table: 'table1',
            // Todo fix this. alter_column should not be boolean
            unique: false
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
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
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
      editCommand.columnAdditions.push({
        name: 'col1',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.tableDeletions.push({ name: 'table1' });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([{ drop_table: { name: 'table1' } }]);
    });

    test('deleting an existing column deletes all column edits', () => {
      editCommand.columnEdits.push({
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
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
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
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
      editCommand.columnAdditions.push({
        name: 'col1',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
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
      editCommand.columnAdditions.push({
        name: 'col1',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.columnEdits.push({
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.columnDeletions['table1'] = ['col1'];
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([]);
    });
    test('editing a new column in an existing table removes the column edit, and gets sent in add_column', () => {
      editCommand.columnAdditions.push({
        name: 'col1',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.columnEdits.push({
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.currentMigration.operations = editsToMigrations(editCommand as EditSchema);
      expect(editCommand.currentMigration.operations).toEqual([
        {
          add_column: {
            table: 'table1',
            column: {
              name: 'col2',
              type: 'text',
              nullable: false,
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
      editCommand.columnAdditions.push({
        name: 'col1',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.columnEdits.push({
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
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
      editCommand.columnAdditions.push({
        name: 'col1',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
      });
      editCommand.columnEdits.push({
        name: 'col2',
        nullable: false,
        originalName: 'col1',
        tableName: 'table1',
        type: 'string',
        unique: false
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
                nullable: false,
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
