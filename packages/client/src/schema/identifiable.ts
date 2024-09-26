import { XataFile } from './files';
import { TableSchema } from './inference';
import { InputXataFile, NumericOperator } from './record';

/**
 * Returns an object with a key and type of the column specified in the schema primary key array.
 *
 * If there is more than one column in the primary key array, it will return the name and type of the first column in the array.
 * If empty, it will check for xata_id column and return that key and type provided it is not null.
 *
 * If neither found, never will be returned.
 */
export type NewIdentifiable<T extends readonly TableSchema[]> = T extends never[]
  ? never
  : T extends readonly unknown[]
  ? T[number] extends { name: string; columns: readonly unknown[] }
    ? {
        [K in T[number]['name']]:
          | PrimaryKeyType<T[number], K>
          | UniqueNotNullType<T[number], K>
          | SinglePrimaryKeyType<T[number], K>;
      }
    : never
  : never;

type PrimaryKeyType<Tables, TableName> = Tables & { name: TableName } extends infer Table
  ? Table extends { name: string; columns: infer Columns } & { primaryKey: infer PrimaryKey }
    ? Columns extends readonly unknown[]
      ? Columns[number] extends { name: string; type: string }
        ? PrimaryKey extends readonly string[] & { 0: string }
          ? {
              [P in PrimaryKey[number]]: PropertyType<Columns[number], P>[P];
            }
          : never
        : never
      : never
    : never
  : never;

type SinglePrimaryKeyType<Tables, TableName> = Tables & { name: TableName } extends infer Table
  ? Table extends { name: string; columns: infer Columns } & { primaryKey: infer PrimaryKey }
    ? Columns extends readonly unknown[]
      ? Columns[number] extends { name: string; type: string }
        ? PrimaryKey extends readonly string[] & { length: 1 }
          ? NonNullable<
              {
                [P in PrimaryKey[number]]: PropertyType<Columns[number], P>[P];
              }[PrimaryKey[number]]
            >
          : never
        : never
      : never
    : never
  : never;

type UniqueNotNullType<Tables, TableName> = Tables & { name: TableName } extends infer Table
  ? Table extends { name: string; columns: infer Columns }
    ? Columns extends readonly unknown[]
      ? Columns[number] extends { name: string; type: string; unique?: boolean; notNull?: boolean }
        ? {
            [K in Columns[number]['name']]: Columns[number] & { name: K } extends infer Column
              ? Column extends { name: string; type: string; unique: true; notNull: true }
                ? { [T in K]: InnerType<Column['type']> }
                : never
              : never;
          }[Columns[number]['name']]
        : never
      : never
    : never
  : never;

type PropertyType<Properties, PropertyName extends PropertyKey> = Properties & {
  name: PropertyName;
} extends infer Property
  ? Property extends {
      name: string;
      type: infer Type;
      link?: { table: string };
      notNull?: infer NotNull;
    }
    ? NotNull extends true
      ? {
          [K in PropertyName]: InnerType<Type>;
        }
      : {
          [K in PropertyName]: InnerType<Type> | null;
        }
    : never
  : never;

type InnerType<Type> = Type extends
  | 'string'
  | 'text'
  | 'email'
  | 'character'
  | 'varchar'
  | 'character varying'
  | `varchar(${number})`
  | `character(${number})`
  ? string
  : Type extends
      | 'int'
      | 'float'
      | 'bigint'
      | 'int8'
      | 'integer'
      | 'int4'
      | 'smallint'
      | 'double precision'
      | 'float8'
      | 'real'
      | 'numeric'
  ? number
  : Type extends 'bool' | 'boolean'
  ? boolean
  : never;

type NewEditableDataFields<T> = T extends Date
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

export type NewEditableData<O> = Partial<{
  [K in keyof O]: NewEditableDataFields<O[K]>;
}>;

type NewEditableDataFieldsWithoutNumeric<T> = T extends Date
  ? string | Date
  : NonNullable<T> extends Date
  ? string | Date | null | undefined
  : T extends XataFile
  ? InputXataFile
  : T extends XataFile[]
  ? InputXataFile[]
  : T extends number
  ? number
  : T;

export type NewEditableDataWithoutNumeric<O> = Partial<{
  [K in keyof O]: NewEditableDataFieldsWithoutNumeric<O[K]>;
}>;
