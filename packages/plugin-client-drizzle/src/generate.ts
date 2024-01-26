import { BaseSchema, Schemas } from '@xata.io/client';
import { boolean, date, decimal, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { exhaustiveCheck } from './utils';

function buildColumnType(column: Schemas.Column) {
  switch (column.type) {
    case 'string':
    case 'text':
    case 'email':
    case 'link':
      return text(column.name);
    case 'bool':
      return boolean(column.name);
    case 'int':
      return integer(column.name);
    case 'float':
      return decimal(column.name);
    case 'datetime':
      return date(column.name);
    case 'multiple':
    case 'vector':
    case 'file[]':
    case 'file':
    case 'json':
      throw new Error(`Unsupported column type: ${column.type}`);
    default:
      return exhaustiveCheck(column.type);
  }
}

function buildColumn(column: Schemas.Column) {
  let type = buildColumnType(column);

  if (column.notNull) {
    type = type.notNull();
  }

  if (column.unique) {
    type = type.unique();
  }

  return type;
}

function buildTable(schema: Schemas.Table) {
  const columns = schema.columns.map((column) => [column.name, buildColumn(column)]);
  const definition = { id: text('id'), ...Object.fromEntries(columns) };
  return pgTable(schema.name, definition);
}

export type DrizzleModels<T extends readonly BaseSchema[]> = T extends never[]
  ? Record<string, Record<string, any>>
  : T extends readonly unknown[]
  ? T[number] extends { name: string; columns: readonly unknown[] }
    ? {
        [K in T[number]['name']]: ReturnType<typeof buildTable>;
      }
    : never
  : never;

export function buildModels<T extends readonly BaseSchema[]>(tables: T): DrizzleModels<T> {
  const entries = tables.map((table) => [table.name, buildTable(table as Schemas.Table)]);
  return Object.fromEntries(entries);
}
