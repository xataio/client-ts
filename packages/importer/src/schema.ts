import type { Schemas } from '@xata.io/client';
import CSV from 'papaparse';
import { isDefined } from './utils/lang';
// @ts-ignore TS doesn't know about the "any-date-parser" module
import DateParser from 'any-date-parser';

export function guessSchemaTypes<T>(rows: T[]): Schemas.Column['type'] {
  // Integer needs to be checked before Float
  if (
    rows.every(
      (value) =>
        // Check for integers
        Number.isSafeInteger(+value) &&
        // Without dots (e.g. 1.0)
        String(value).match(/^\d+$/) &&
        // Are not dates
        !(value instanceof Date)
    )
  ) {
    return 'int';
  }

  if (
    rows.every(
      (value) =>
        // Check for floats
        !Number.isNaN(+value) &&
        // Are not dates
        !(value instanceof Date)
    )
  ) {
    return 'float';
  }

  if (
    rows.every(
      (value) =>
        // Check for valid dates
        DateParser.fromAny(value).invalid === undefined
    )
  ) {
    return 'datetime';
  }

  if (
    rows.every((value) =>
      // Check for booleans
      ['true', 'false'].includes(String(value))
    )
  ) {
    return 'bool';
  }

  if (
    rows.every((value) =>
      // Check for emails
      String(value).match(/^\S+@\S+\.\S+$/)
    )
  ) {
    return 'email';
  }

  // Array needs to be checked before Object
  try {
    if (
      rows.every(
        (value) =>
          // Check for arrays
          Array.isArray(value) ||
          // JSON arrays
          JSON.parse(String(value)).length > 0
      )
    ) {
      return 'multiple';
    }
  } catch (_error) {
    // Ignore
  }

  // CSV Arrays
  if (rows.every((value) => CSV.parse(String(value), { header: false }).errors.length === 0)) {
    return 'multiple';
  }

  try {
    if (
      rows.every(
        (value) =>
          // Check for valid JSON
          typeof JSON.parse(String(value)) === 'object'
      )
    ) {
      return 'object';
    }
  } catch (_error) {
    // Ignore
  }

  if (
    rows.some(
      (value) =>
        // Check for newlines
        String(value).indexOf('\n') >= 0 ||
        // Check for long strings
        String(value).length > 180
    )
  ) {
    return 'text';
  }

  return 'string';
}

export function coerceValue(value: unknown, type: Schemas.Column['type']): string | number | boolean | Date | null {
  if (!isDefined(value)) {
    return value;
  } else if (String(value).trim() === '') {
    return null;
  }

  switch (type) {
    case 'string':
    case 'text': {
      return isDefined(value) ? String(value) : '';
    }
    case 'int': {
      return isDefined(value) ? parseInt(String(value), 10) : 0;
    }
    case 'float': {
      return isDefined(value) ? parseFloat(String(value)) : 0;
    }
    case 'bool': {
      return isDefined(value) ? String(value) === 'true' || String(value) === '1' : false;
    }
    case 'datetime': {
      const date = DateParser.fromAny(value);
      return date.invalid ? (value as Date) : date;
    }
    default: {
      return value as string | number | boolean | Date | null;
    }
  }
}

export function coerceSchema<T>(schema: Schemas.Schema, rows: T[], nullValues: any[] = []): T[] {
  return rows.map((row) => {
    const newRow = { ...row };

    for (const column of schema.tables[0].columns) {
      // @ts-ignore TODO: Remove this
      newRow[column.name] = coerceValue(row[column.name], column.type);
    }

    return newRow;
  });
}

export function guessSchema<T extends Record<string, unknown>>(
  name: string,
  rows: T[],
  nullValues: any[] = []
): Schemas.Schema {
  const columnNames = new Set<string>(...rows.map((row) => Object.keys(row)));

  const columns = [...columnNames].map((columnName) => {
    const values = rows.map((row) => row[columnName]);
    const type = guessSchemaTypes(values);

    return { name: columnName, type };
  });

  return { tables: [{ name, columns }] };
}
