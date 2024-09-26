import { UnionToIntersection, Values } from '../util/types';
import { XataArrayFile, XataFile } from './files';
import { JSONValue } from './json';

export type DatabaseSchema = {
  tables: readonly TableSchema[];
};

export type TableSchema = {
  name: string;
  columns: readonly {
    name: string;
    type: string;
    notNull?: boolean;
  }[];
  primaryKey?: readonly string[];
};

export type SchemaInference<T extends readonly TableSchema[]> = T extends never[]
  ? Record<string, Record<string, any>>
  : T extends readonly unknown[]
  ? T[number] extends { name: string; columns: readonly unknown[] }
    ? {
        [K in T[number]['name']]: TableType<T[number], K>;
      }
    : never
  : never;

type TableType<Tables, TableName> = Tables & { name: TableName } extends infer Table
  ? Table extends { name: string; columns: infer Columns }
    ? Columns extends readonly unknown[]
      ? Columns[number] extends { name: string; type: string }
        ? UnionToIntersection<Values<{ [K in Columns[number]['name']]: PropertyType<Tables, Columns[number], K> }>>
        : never
      : never
    : never
  : never;

type PropertyType<Tables, Properties, PropertyName extends PropertyKey> = Properties & {
  name: PropertyName;
} extends infer Property
  ? Property extends {
      name: string;
      type: infer Type;
      link?: { table: infer LinkedTable };
      notNull?: infer NotNull;
    }
    ? NotNull extends true
      ? {
          [K in PropertyName]: InnerType<Type, Tables, LinkedTable>;
        }
      : {
          [K in PropertyName]?: InnerType<Type, Tables, LinkedTable> | null;
        }
    : never
  : never;

type InnerType<Type, Tables, LinkedTable> = Type extends
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
  : Type extends 'datetime' | 'timestamptz'
  ? Date
  : Type extends 'multiple' | 'text[]'
  ? string[]
  : Type extends 'vector' | 'real[]' | 'float[]' | 'double precision[]' | 'float8[]' | 'numeric[]'
  ? number[]
  : Type extends 'int[]' | 'bigint[]' | 'int8[]' | 'integer[]' | 'int4[]' | 'smallint[]'
  ? number[]
  : Type extends 'bool[]' | 'boolean[]'
  ? boolean[]
  : Type extends 'file' | 'xata_file'
  ? XataFile
  : Type extends 'file[]' | 'xata_file_array'
  ? XataArrayFile[]
  : Type extends 'json' | 'jsonb'
  ? JSONValue<any>
  : Type extends 'link'
  ? string
  : // This is a fallback for when the type is not recognized
    string;
