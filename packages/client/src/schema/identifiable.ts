import { Values } from '../util/types';
import { XataFile } from './files';
import { BaseSchema, InnerType } from './inference';
import { InputXataFile, NumericOperator, XataRecord } from './record';

/**
 * Returns an object with a key and type of the column specified in the schema primary key array.
 *
 * If there is more than one column in the primary key array, it will return the name and type of the first column in the array.
 * If empty, it will check for xata_id column and return that key and type provided it is unique and not null.
 *
 * If neither found, or neither column is not unique + notnull, never will be returned.
 */
export type NewIdentifiable<T extends readonly BaseSchema[]> = T extends never[]
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
                ? PropertyType<Tables, Columns[number], K>
                : K extends 'xata_id'
                ? PropertyType<Tables, Columns[number], K>
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

export type NewIndentifierValue<T extends object> = {
  [K in keyof T]: T[K] extends never ? never : T[K];
}[keyof T];

export type NewIdentifierKey<T extends object> = {
  [K in keyof T]: T[K] extends never ? never : K;
}[keyof T];

export type NewEditableDataFields<T> = T extends XataRecord
  ? NewIdentifiable<readonly BaseSchema[]> | NewIndentifierValue<NewIdentifiable<readonly BaseSchema[]>>
  : NonNullable<T> extends XataRecord
  ?
      | NewIdentifiable<readonly BaseSchema[]>
      | NewIndentifierValue<NewIdentifiable<readonly BaseSchema[]>>
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

export type NewEditableData<O extends XataRecord> = NewIdentifiable<readonly BaseSchema[]> &
  Partial<
    Omit<
      {
        [K in keyof O]: NewEditableDataFields<O[K]>;
      },
      keyof XataRecord
    >
  >;
