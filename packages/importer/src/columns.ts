import type { Schemas } from '@xata.io/client';
import { isDefined } from './utils/lang';
import AnyDateParser from 'any-date-parser';

const anyToDate = AnyDateParser.exportAsFunctionAny();

const isInteger = <T>(
  value: T
): boolean => // Check for integers
  Boolean(
    Number.isSafeInteger(+value) &&
      // Without dots (e.g. 1.0)
      String(value).match(/^\d+$/) &&
      // Are not dates
      !(value instanceof Date)
  );

const isFloat = <T>(
  value: T
): boolean => // Check for integers
  Boolean(
    // Check for floats
    !Number.isNaN(+value) &&
      // Are not dates
      !(value instanceof Date)
  );

const isDateTime = <T>(value: T): boolean => anyToDate(value).invalid === undefined;

const BOOLEAN_VALUES = ['true', 'false'];

const isBoolean = <T>(value: T): boolean => BOOLEAN_VALUES.includes(String(value));

const isEmail = <T>(value: T): boolean => /^\S+@\S+\.\S+$/.test(String(value));

const isText = <T>(value: T): boolean =>
  // Check for newlines
  String(value).indexOf('\n') >= 0 ||
  // Check for long strings
  String(value).length > 180;

export function guessColumnTypes<T>(columnValues: T[]): Schemas.Column['type'] {
  // Integer needs to be checked before Float
  if (columnValues.every(isInteger)) {
    return 'int';
  }
  if (columnValues.every(isFloat)) {
    return 'float';
  }
  if (columnValues.every(isDateTime)) {
    return 'datetime';
  }
  if (columnValues.every(isBoolean)) {
    return 'bool';
  }
  if (columnValues.every(isEmail)) {
    return 'email';
  }
  // text needs to be checked before string
  if (columnValues.some(isText)) {
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
      const date = anyToDate(value);
      return date.invalid ? (value as Date) : date;
    }
    default: {
      return value as string | number | boolean | Date | null;
    }
  }
}

// todo: honor nullValues
export function coerceColumns<T>(columns: Schemas.Column[], rows: T[], nullValues: any[] = []): T[] {
  return rows.map((row) => {
    const newRow = { ...row };
    for (const column of columns) {
      // @ts-ignore TODO: Remove this
      newRow[column.name] = coerceValue(row[column.name], column.type);
    }
    return newRow;
  });
}

// todo: honor nullValues?
export function guessColumns<T extends Record<string, unknown>>(rows: T[], nullValues: any[] = []): Schemas.Column[] {
  const columnNames = new Set<string>(...rows.map((row) => Object.keys(row)));

  const columns = [...columnNames].map((columnName) => {
    const values = rows.map((row) => row[columnName]);
    const type = guessColumnTypes(values);

    return { name: columnName, type };
  });

  return columns;
}
