import { test } from 'vitest';
import { NewIdentifiable, NewIdentifierKey, NewIndentifierValue } from './identifiable';

const tables = [
  {
    name: 'teams',
    primaryKey: ['xata_id'],
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

type DbIndentifiable = NewIdentifiable<typeof tables>;

function updateTeams(identifable: DbIndentifiable['teams']) {}
updateTeams({ xata_id: true });
// @ts-ignore
updateTeams(1);
// @ts-ignore
updateTeams('1');

function updateUsers(identifable: DbIndentifiable['users']) {}
updateUsers({ userdefined: 1 });
// @ts-ignore
updateUsers('1');

function updatePets(identifable: DbIndentifiable['pets']) {}
updatePets({ xata_id: '1' });
// @ts-ignore
updatePets(1);

function updateDatetime(identifable: DbIndentifiable['datetime']) {}
updateDatetime({ xata_id: new Date() });
// @ts-ignore
updateDatetime('1');
// @ts-ignore
updateDatetime(1);

function updateMultiple(identifable: DbIndentifiable['multiple']) {}
updateMultiple({ xata_id: ['1'] });
// @ts-ignore
updateMultiple('1');
// @ts-ignore
updateMultiple(1);

function updateVector(identifable: DbIndentifiable['vector']) {}
updateVector({ xata_id: [1, 2] });
// @ts-ignore
updateVector('1');
// @ts-ignore
updateVector(1);

function updateBoolean(identifable: DbIndentifiable['boolean[]']) {}
updateBoolean({ xata_id: [true, false] });
// @ts-ignore
updateBoolean('1');
// @ts-ignore
updateBoolean(1);

function updateJsonB(identifable: DbIndentifiable['jsonb']) {}
updateJsonB({
  xata_id: {
    one: 'two'
  }
});
// @ts-ignore
updateJsonB('1');
// @ts-ignore
updateJsonB(1);

function updateUnknown(identifable: DbIndentifiable['unknown']) {}
updateUnknown({ xata_id: '1' });
// @ts-ignore
updateUnknown('1');
// @ts-ignore
updateUnknown(1);

function updateNeither(identifable: DbIndentifiable['neither']) {}
// @ts-ignore
updateNeither('1');
// @ts-ignore
updateNeither(1);

const identifierValueType: NewIndentifierValue<NewIdentifiable<typeof tables>['users']> = 2;
const identifierKeyName: NewIdentifierKey<NewIdentifiable<typeof tables>['users']> = 'userdefined';

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
