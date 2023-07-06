import type { Schemas } from '@xata.io/client';
import AnyDateParser from 'any-date-parser';
import { ColumnOptions, ToBoolean } from './types';
import { isDefined } from './utils/lang';

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
      !(value instanceof Date) &&
      value !== ''
  );

const isDateTime = <T>(value: T): boolean => anyToDate(value).invalid === undefined;

const isBoolean = <T>(value: T, toBoolean: ToBoolean): boolean => {
  const toBooleanValue = toBoolean(value);
  return isDefined(toBooleanValue) && [true, false].includes(toBooleanValue);
};

const isEmail = <T>(value: T): boolean => /^\S+@\S+\.\S+$/.test(String(value));

const isText = <T>(value: T): boolean =>
  // Check for newlines
  String(value).indexOf('\n') >= 0 ||
  // Check for long strings
  String(value).length > 180;

// should both of these be a function?
const defaultIsNull = (value: unknown): boolean => {
  return !isDefined(value) || String(value).toLowerCase() === 'null' || String(value).trim() === '';
};

const DEFAULT_BOOLEAN_VALUES = { true: ['true', 't', 'yes', 'y'], false: ['false', 'f', 'no', 'n'] };

const defaultToBoolean: ToBoolean = (value) => {
  if (DEFAULT_BOOLEAN_VALUES.true.includes(String(value).toLowerCase())) {
    return true;
  }
  if (DEFAULT_BOOLEAN_VALUES.false.includes(String(value).toLowerCase())) {
    return false;
  }
  return null;
};

export const guessColumnTypes = <T>(
  columnValuesWithNulls: T[],
  options: ColumnOptions = {}
): Schemas.Column['type'] => {
  const { isNull = defaultIsNull, toBoolean = defaultToBoolean } = options;
  const columnValues = columnValuesWithNulls.filter((value) => !isNull(value));
  if (columnValues.length === 0) {
    return 'string';
  }
  if (columnValues.every((value) => isBoolean(value, toBoolean))) {
    return 'bool';
  }
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
  if (columnValues.every(isEmail)) {
    return 'email';
  }
  // text needs to be checked before string
  if (columnValues.some(isText)) {
    return 'text';
  }
  return 'string';
};

export const coerceValue = (
  value: unknown,
  type: Schemas.Column['type'],
  options: ColumnOptions = {}
): string | number | boolean | Date | null => {
  const { isNull = defaultIsNull, toBoolean = defaultToBoolean } = options;

  if (isNull(value)) {
    return null;
  }

  switch (type) {
    case 'string':
    case 'text': {
      return String(value);
    }
    case 'int': {
      return isInteger(value) ? parseInt(String(value), 10) : null;
    }
    case 'float': {
      return isFloat(value) ? parseFloat(String(value)) : null;
    }
    case 'bool': {
      return toBoolean(value);
    }
    case 'datetime': {
      const date = anyToDate(value);
      return date.invalid ? null : date;
    }
    default: {
      return value as string | number | boolean | Date | null;
    }
  }
};

export const coerceRows = <T extends Record<string, unknown>>(
  rows: T[],
  columns: Schemas.Column[],
  options?: ColumnOptions
): T[] => {
  return rows.map((row) => {
    return columns.reduce((newRow, column) => {
      (newRow as Record<string, unknown>)[column.name] = coerceValue(row[column.name], column.type, options);
      return newRow;
    }, {}) as T;
  });
};

export const guessColumns = <T extends Record<string, unknown>>(
  rows: T[],
  options?: ColumnOptions
): Schemas.Column[] => {
  const columnNames = new Set<string>(...rows.map((row) => Object.keys(row)));

  return [...columnNames].map((columnName) => {
    const values = rows.map((row) => row[columnName]);
    const type = guessColumnTypes(values, options);
    return { name: columnName, type };
  });
};
