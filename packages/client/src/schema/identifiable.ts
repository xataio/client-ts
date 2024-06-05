import { AtLeastOne, Values } from '../util/types';
import { XataFile } from './files';
import { BaseSchema, InnerType } from './inference';
import { InputXataFile, NumericOperator, XataRecord } from './record';
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
    primaryKey: ['xata_id'],
    columns: [
      { name: 'xata_id', type: 'int', notNull: true, unique: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true },
      { name: 'email', type: 'email', unique: true }
    ]
  },
  {
    name: 'pets',
    primaryKey: ['xata_id'],
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

/**
 * This type returns the type of the column specified in the schema primary key array.
 *
 * If there is more than one column in the primary key array, it will return the type of the first column in the array.
 * If empty, it will check for xata_id column and return that type provided it is unique and not null.
 *
 * If neither found, or neither column is not unique + notnull, never will be returned.
 */
export type NewIdentifier<T extends readonly BaseSchema[]> = T extends never[]
  ? never
  : T extends readonly unknown[]
  ? T[number] extends { name: string; columns: readonly unknown[] }
    ? {
        [K in T[number]['name']]: PrimaryKeyType<T[number], K>;
      }
    : never
  : never;

export type PrimaryKeyType<Tables, TableName> = Tables & { name: TableName } extends infer Table
  ? Table extends { name: string; columns: infer Columns } & { primaryKey: infer primaryKey }
    ? Columns extends readonly unknown[]
      ? Columns[number] extends { name: string; type: string }
        ? primaryKey extends readonly string[]
          ? Values<{
              [K in Columns[number]['name']]: K extends primaryKey[0]
                ? Values<PropertyType<Tables, Columns[number], K>>
                : K extends 'xata_id'
                ? Values<PropertyType<Tables, Columns[number], K>>
                : never;
            }>
          : never
        : never
      : never
    : never
  : never;

export type PropertyType<Tables, Properties, PropertyName extends PropertyKey> = Properties & {
  name: PropertyName;
} extends infer Property
  ? Property extends {
      name: string;
      type: infer Type;
      link?: { table: infer LinkedTable };
      notNull?: infer NotNull;
      unique?: infer Unique;
    }
    ? NotNull extends true
      ? Unique extends true
        ? {
            [K in PropertyName]: InnerType<Type, Tables, LinkedTable>;
          }
        : never
      : never
    : never
  : never;

// How to make this key: string be the actual name of the new identifier key?
export type NewIdentifiable = {
  [key: string]: NewIdentifier<readonly BaseSchema[]>;
};

export type NewIdentifierName<T extends readonly BaseSchema[]> = T extends never[]
  ? never
  : T extends readonly unknown[]
  ? T[number] extends { name: string; columns: readonly unknown[] }
    ? {
        [K in T[number]['name']]: Name<T[number], K>;
      }
    : never
  : never;

export type RemoveNever<T> = { [P in keyof T as T[P] extends never ? never : P]: T[P] };

export type Name<Tables, TableName> = Tables & { name: TableName } extends infer Table
  ? Table extends { name: string; columns: infer Columns } & { primaryKey: infer primaryKey }
    ? Columns extends readonly unknown[]
      ? Columns[number] extends { name: string; type: string }
        ? primaryKey extends readonly string[]
          ? keyof RemoveNever<{
              [K in Columns[number]['name']]: K extends primaryKey[0]
                ? Values<PropertyType<Tables, Columns[number], K> extends never ? never : K>
                : K extends 'xata_id'
                ? Values<PropertyType<Tables, Columns[number], K> extends never ? never : K>
                : never;
            }>
          : never
        : never
      : never
    : never
  : never;

// TO narrow the name of the field that needs to be passed in,
// the key should be the name of the primary key
export type NewEditableDataFields<T> = T extends XataRecord
  ? AtLeastOne<{ [key: string]: NewIdentifier<readonly BaseSchema[]> }> | NewIdentifier<readonly BaseSchema[]>
  : NonNullable<T> extends XataRecord
  ?
      | AtLeastOne<{ [key: string]: NewIdentifier<readonly BaseSchema[]> }>
      | NewIdentifier<readonly BaseSchema[]>
      | null
      | undefined
  : T extends Date
  ? string | Date
  : NonNullable<T> extends Date
  ? string | Date | null | undefined
  : T extends XataFile
  ? InputXataFile
  : T extends XataFile[]
  ? InputXataFile[]
  : T extends number
  ? number | NumericOperator
  : T;

export type NewEditableData<O extends XataRecord> = NewIdentifiable &
  Partial<
    Omit<
      {
        [K in keyof O]: NewEditableDataFields<O[K]>;
      },
      keyof XataRecord
    >
  >;
