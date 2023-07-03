import type { Schemas } from '@xata.io/client';
import AnyDateParser from 'any-date-parser';
import { BooleanValues, ColumnOptions } from './types';
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

const isBoolean = <T>(value: T, booleanValues: BooleanValues): boolean =>
  [...booleanValues.true, ...booleanValues.false].includes(String(value).toLowerCase());

const isEmail = <T>(value: T): boolean => /^\S+@\S+\.\S+$/.test(String(value));

const isText = <T>(value: T): boolean =>
  // Check for newlines
  String(value).indexOf('\n') >= 0 ||
  // Check for long strings
  String(value).length > 180;

const defaultIsNull = (value: unknown): boolean => {
  return !isDefined(value) || String(value).toLowerCase() === 'null' || String(value).trim() === '';
};

const defaultBooleanValues: BooleanValues = { true: ['true', 't', 'yes', 'y'], false: ['false', 'f', 'no', 'n'] };

export const guessColumnTypes = <T>(
  columnValuesWithNulls: T[],
  options: ColumnOptions = {}
): Schemas.Column['type'] => {
  const { isNull = defaultIsNull, booleanValues = defaultBooleanValues } = options;
  const columnValues = columnValuesWithNulls.filter((value) => !isNull(value));
  if (columnValues.length === 0) {
    return 'string';
  }
  if (columnValues.every((value) => isBoolean(value, booleanValues))) {
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

const coerceBoolean = (value: unknown, booleanValues: BooleanValues): boolean | null => {
  const valueString = String(value).toLowerCase();
  if (booleanValues.true.includes(valueString)) {
    return true;
  }
  if (booleanValues.false.includes(valueString)) {
    return false;
  }
  return null;
};

export const coerceValue = (
  value: unknown,
  type: Schemas.Column['type'],
  options: ColumnOptions = {}
): string | number | boolean | Date | null => {
  const { isNull = defaultIsNull, booleanValues = defaultBooleanValues } = options;

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
      return coerceBoolean(value, booleanValues);
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
