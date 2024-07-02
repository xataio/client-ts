import { test } from 'vitest';
import { NewIdentifiable, NewIdentifierKey, NewIndentifierValue } from './identifiable';

const tables = [
  {
    name: 'teams',
    primaryKey: ['xata_id'],
    foreignKeys: {
      pet_pet: {
        name: 'pet_pet',
        columns: ['pet'],
        referencedTable: 'pets',
        referencedColumns: ['xata_id'],
        onDelete: 'SET NULL'
      }
    },
    columns: [
      { name: 'xata_id', type: 'boolean', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true },
      { name: 'email', type: 'email', unique: true },
      { name: 'pet', type: 'link', link: { table: 'pets' } },
      { name: 'account_value', type: 'int' },
      { name: 'vector', type: 'vector', vector: { dimension: 4 } }
    ]
  },
  {
    name: 'users',
    primaryKey: ['userdefined'],
    columns: [
      { name: 'userdefined', type: 'int', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true },
      { name: 'email', type: 'email', unique: true }
    ]
  },
  {
    name: 'pets',
    primaryKey: [],
    columns: [
      { name: 'xata_id', type: 'text', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true },
      { name: 'name', type: 'string', notNull: true, unique: true }
    ]
  },
  {
    name: 'datetime',
    primaryKey: ['xata_id'],
    columns: [
      { name: 'xata_id', type: 'datetime', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true }
    ]
  },
  {
    name: 'multiple',
    primaryKey: ['xata_id'],
    columns: [
      { name: 'xata_id', type: 'multiple', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true }
    ]
  },
  {
    name: 'vector',
    primaryKey: ['xata_id'],
    columns: [
      { name: 'xata_id', type: 'vector', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true }
    ]
  },
  {
    name: 'boolean[]',
    primaryKey: ['xata_id'],
    columns: [
      { name: 'xata_id', type: 'boolean[]', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true }
    ]
  },
  {
    name: 'jsonb',
    primaryKey: ['xata_id'],
    columns: [
      { name: 'xata_id', type: 'json', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true }
    ]
  },
  {
    name: 'unknown',
    primaryKey: [],
    columns: [
      { name: 'xata_id', type: 'text', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true }
    ]
  },
  {
    name: 'neither',
    primaryKey: [],
    columns: [
      { name: 'xata_id', type: 'text' },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true }
    ]
  }
] as const;

type DbIndentifiable = NewIdentifiable<typeof tables>['users'];
type DbIndentifiableKey = NewIdentifierKey<DbIndentifiable>;
type DbIndentifiableValue = NewIndentifierValue<DbIndentifiable>;

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
