import type { Schemas } from '@xata.io/client';
import CSV from 'papaparse';
import AnyDateParser from 'any-date-parser';
import { ColumnOptions, ToBoolean } from './types';
import { isDefined } from './utils/lang';
import { isValidEmail } from './utils/email';

const anyToDate = AnyDateParser.exportAsFunctionAny();

const isInteger = <T>(
  value: T
): boolean => // Check for integers
  Boolean(
    Number.isSafeInteger(+value) &&
      // Without dots (e.g. 1.0)
      String(value).match(/^[-]?\d+$/) &&
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

const isEmail = <T>(value: T): boolean => isValidEmail(String(value));

const isText = <T>(value: T): boolean =>
  // Check for newlines
  String(value).indexOf('\n') >= 0 ||
  // Check for long strings
  String(value).length > 180;

const tryIsJsonArray = (string: string): boolean => {
  try {
    const parsed = JSON.parse(string);
    return parsed.length > 0 && Array.isArray(parsed);
  } catch (_error) {
    return false;
  }
};

const tryIsCsvArray = (string: string): boolean => {
  try {
    return CSV.parse(string, { header: false }).errors.length === 0;
  } catch (_error) {
    return false;
  }
};

const parseMultiple = (value: string): string[] | null => {
  if (tryIsJsonArray(value)) {
    return JSON.parse(value) as string[];
  }
  return CSV.parse(value, { header: false }).data[0] as string[];
};

const isGuessableMultiple = <T>(value: T): boolean => Array.isArray(value) || tryIsJsonArray(String(value));

const isMultiple = <T>(value: T): boolean => isGuessableMultiple(value) || tryIsCsvArray(String(value));

const isMaybeMultiple = <T>(value: T): boolean => isMultiple(value) || typeof value === 'string';

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
  if (columnValues.some(isGuessableMultiple)) {
    return 'multiple';
  }
  // text needs to be checked before string
  if (columnValues.some(isText)) {
    return 'text';
  }
  return 'string';
};

export type CoercedValue = { value: string | string[] | number | boolean | Date | null; isError: boolean };

export const coerceValue = (
  value: unknown,
  type: Schemas.Column['type'],
  options: ColumnOptions = {}
): CoercedValue => {
  const { isNull = defaultIsNull, toBoolean = defaultToBoolean } = options;

  if (isNull(value)) {
    return { value: null, isError: false };
  }

  switch (type) {
    case 'string':
    case 'text':
    case 'link': {
      return { value: String(value), isError: false };
    }
    case 'email': {
      return isEmail(value) ? { value: String(value), isError: false } : { value: null, isError: true };
    }
    case 'int': {
      return isInteger(value) ? { value: parseInt(String(value), 10), isError: false } : { value: null, isError: true };
    }
    case 'float': {
      return isFloat(value) ? { value: parseFloat(String(value)), isError: false } : { value: null, isError: true };
    }
    case 'bool': {
      const boolValue = toBoolean(value);
      return { value: boolValue, isError: boolValue === null };
    }
    case 'datetime': {
      const date = anyToDate(value);
      return date.invalid ? { value: null, isError: true } : { value: date, isError: false };
    }
    case 'multiple': {
      return isMaybeMultiple(value)
        ? { value: parseMultiple(String(value)), isError: false }
        : { value: null, isError: true };
    }
    default: {
      return { value: null, isError: true };
    }
  }
};

export const coerceRows = <T extends Record<string, unknown>>(
  rows: T[],
  columns: Schemas.Column[],
  options?: ColumnOptions
): Record<string, CoercedValue>[] => {
  return rows.map((row) => {
    return columns.reduce((newRow, column) => {
      (newRow as Record<string, CoercedValue>)[column.name] = coerceValue(row[column.name], column.type, options);
      return newRow;
    }, {}) as Record<string, CoercedValue>;
  });
};

export const guessColumns = <T extends Record<string, unknown>>(
  rows: T[],
  options?: ColumnOptions
): Schemas.Column[] => {
  const columnNames = new Set<string>(...rows.map((row) => Object.keys(row)));

  return [...columnNames].map((columnName) => {
    const values = rows.map((row) => row[columnName]);
    const type = columnName === 'id' ? 'string' : guessColumnTypes(values, options);
    return { name: columnName, type };
  });
};
