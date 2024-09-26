import { test } from 'vitest';
import { NewIdentifiable } from './identifiable';

const tables = [
  {
    name: 'PrimaryKey',
    primaryKey: ['pk'],
    columns: [
      { name: 'pk', type: 'int', notNull: true, unique: true },
      { name: 'email', type: 'email', unique: true }
    ]
  },
  {
    name: 'NullablePrimaryKey',
    primaryKey: ['pk'],
    columns: [
      { name: 'pk', type: 'int', notNull: false, unique: true },
      { name: 'name', type: 'string' }
    ]
  },
  {
    name: 'UniqueNotNull',
    primaryKey: [],
    columns: [
      { name: 'foo', type: 'string', notNull: true, unique: true },
      { name: 'name', type: 'string' }
    ]
  },
  {
    name: 'CompositePrimaryKey',
    primaryKey: ['a', 'b'],
    columns: [
      { name: 'a', type: 'int', notNull: true, unique: true },
      { name: 'b', type: 'string', notNull: true, unique: true },
      { name: 'name', type: 'string' }
    ]
  },
  {
    name: 'Mixture',
    primaryKey: ['a', 'b'],
    columns: [
      { name: 'a', type: 'int', notNull: true, unique: true },
      { name: 'b', type: 'string', notNull: true, unique: true },
      { name: 'c', type: 'string', notNull: true, unique: true },
      { name: 'name', type: 'string' }
    ]
  },
  {
    name: 'None',
    primaryKey: [],
    columns: [{ name: 'name', type: 'string' }]
  }
] as const;

test('PrimaryKey', () => {
  type Type = NewIdentifiable<typeof tables>['PrimaryKey'];

  const user: Type = { pk: 1 };
  const user1: Type = 1;
  // @ts-expect-error
  const user2: Type = { pk: '1' };
  // @ts-expect-error
  const user3: Type = { pk: 1, xata_version: 1 };
});

test('NullablePrimaryKey', () => {
  type Type = NewIdentifiable<typeof tables>['NullablePrimaryKey'];

  const user: Type = { pk: 1 };
  const user1: Type = 1;
  // @ts-expect-error
  const user2: Type = { pk: '1' };
  // @ts-expect-error
  const user3: Type = { pk: 1, xata_version: 1 };
});

test('UniqueNotNull', () => {
  type Type = NewIdentifiable<typeof tables>['UniqueNotNull'];

  const user: Type = { foo: 'bar' };
  // @ts-expect-error
  const user1: Type = { foo: 1 };
  // @ts-expect-error
  const user2: Type = { foo: 'bar', xata_version: 1 };
});

test('CompositePrimaryKey', () => {
  type Type = NewIdentifiable<typeof tables>['CompositePrimaryKey'];

  const user: Type = { a: 1, b: '2' };
  // @ts-expect-error
  const user1: Type = { a: '1', b: '2' };
  // @ts-expect-error
  const user2: Type = { a: 1, b: '2', xata_version: 1 };
});

test('Mixture', () => {
  type Type = NewIdentifiable<typeof tables>['Mixture'];

  const user: Type = { a: 1, b: '2', c: '3' };
  // @ts-expect-error
  const user1: Type = { a: '1', b: '2', c: '3' };
  // @ts-expect-error
  const user2: Type = { a: 1, b: '2', c: '3', xata_version: 1 };
});
