import { Schemas } from '../api';

type BaseSchema = {
  name: string;
  columns: readonly (
    | {
        name: string;
        type: Schemas.Column['type'];
      }
    | { name: string; type: 'link'; link: { table: string } }
    | { name: string; type: 'object'; columns: { name: string; type: string }[] }
  )[];
};

export type SchemaInference<T extends readonly BaseSchema[]> = T extends readonly unknown[]
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
        ? { [K in Columns[number]['name']]: PropertyType<Tables, Columns[number], K> }
        : never
      : never
    : never
  : never;

type PropertyType<Tables, Properties, PropertyName> = Properties & { name: PropertyName } extends infer Property
  ? Property extends {
      name: string;
      type: infer Type;
      link?: { table: infer LinkedTable };
      columns?: infer ObjectColumns;
    }
    ? Type extends 'string' | 'email'
      ? string
      : Type extends 'int'
      ? number
      : Type extends 'date'
      ? Date
      : Type extends 'multiple'
      ? string[]
      : Type extends 'object'
      ? ObjectColumns extends readonly unknown[]
        ? ObjectColumns[number] extends { name: string; type: string }
          ? { [K in ObjectColumns[number]['name']]: PropertyType<Tables, ObjectColumns[number], K> }
          : never
        : never
      : Type extends 'link'
      ? TableType<Tables, LinkedTable>
      : never
    : never
  : never;
