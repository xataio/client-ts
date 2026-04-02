import { Schemas, XataFile } from '@xata.io/client';

import AnyDateParser from 'any-date-parser';
import CSV from 'papaparse';
import { ColumnOptions, ToBoolean } from './types';
import { isValidEmail } from './utils/email';
import { compact, isDefined, isString } from './utils/lang';

const anyToDate = AnyDateParser.exportAsFunctionAny();

const isInteger = <T>(value: T): boolean => /^[-]?\d+$/.test(String(value).trim());

const isFloat = <T>(value: T): boolean => /^[-]?\d+(\.\d*)?$/.test(String(value).trim());

const isDateTime = <T>(value: T): boolean => anyToDate(value).invalid === undefined;

const isBoolean = <T>(value: T, toBoolean: ToBoolean): boolean => {
  const toBooleanValue = toBoolean(value);
  return isDefined(toBooleanValue) && [true, false].includes(toBooleanValue);
};

const isEmail = <T>(value: T): boolean => isValidEmail(String(value).trim());

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

const isGuessableVectorColumn = <T>(values: T[]): boolean => {
  const checks = values.map((value) => {
    const isMultiple = isGuessableMultiple(value);
    if (!isMultiple) return null;

    const array = parseMultiple(String(value)) ?? [];
    if (array.some((item) => !isFloat(item))) return null;

    return array.length;
  });

  return checks.every((length) => length !== null && length > 50);
};

const isMultiple = <T>(value: T): boolean => isGuessableMultiple(value) || tryIsCsvArray(String(value));

const isMaybeMultiple = <T>(value: T): boolean => isMultiple(value) || typeof value === 'string';

const isDataUri = <T>(value: T): boolean => isString(value) && /(data:.*?;base64,.*?(?:[;,|]|$))/g.test(value);

// should both of these be a function?
const defaultIsNull = (value: unknown): boolean => {
  return !isDefined(value) || String(value).toLowerCase() === 'null' || String(value).trim() === '';
};

const DEFAULT_BOOLEAN_VALUES = { true: ['true', 't', 'yes', 'y'], false: ['false', 'f', 'no', 'n'] };

const defaultToBoolean: ToBoolean = (value) => {
  if (DEFAULT_BOOLEAN_VALUES.true.includes(String(value).trim().toLowerCase())) {
    return true;
  }
  if (DEFAULT_BOOLEAN_VALUES.false.includes(String(value).trim().toLowerCase())) {
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
  if (isGuessableVectorColumn(columnValues)) {
    return 'vector';
  }
  if (columnValues.some(isGuessableMultiple)) {
    return 'multiple';
  }
  if (columnValues.some((value) => isDataUri(value))) {
    return 'file[]';
  }
  // text needs to be checked before string
  if (columnValues.some(isText)) {
    return 'text';
  }
  return 'string';
};

export type CoercedValue = {
  value: string | string[] | number | boolean | Date | null | XataFile | XataFile[];
  isError: boolean;
};

export const coerceValue = async (
  value: unknown,
  column: Schemas.Column,
  options: ColumnOptions = {}
): Promise<CoercedValue> => {
  const { isNull = defaultIsNull, toBoolean = defaultToBoolean, proxyFunction } = options;

  if (isNull(value)) {
    return { value: null, isError: false };
  }

  switch (column.type) {
    case 'string':
    case 'text':
    case 'link': {
      return { value: String(value), isError: false };
    }
    case 'email': {
      return isEmail(value) ? { value: String(value).trim(), isError: false } : { value: null, isError: true };
    }
    case 'int': {
      return isInteger(value) || isFloat(value)
        ? { value: parseInt(String(value), 10), isError: false }
        : { value: null, isError: true };
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
    case 'vector': {
      if (!isMaybeMultiple(value)) return { value: null, isError: true };
      const array = parseMultiple(String(value));

      return {
        value: array,
        isError: array?.some((item) => !isFloat(item)) || array?.length !== column.vector?.dimension
      };
    }
    case 'multiple': {
      return isMaybeMultiple(value)
        ? { value: parseMultiple(String(value)), isError: false }
        : { value: null, isError: true };
    }
    case 'file': {
      const file = await parseFile((value as string).trim(), proxyFunction);
      if (!file) return { value: null, isError: true };

      return { value: file, isError: false };
    }
    case 'file[]': {
      // Regex in 3 parts to detect delimited strings of base64 data uris, URLs and local files
      const items =
        (value as string)
          .match(/(data:.*?;base64,.*?(?:[;,|]|$))|(https?:\/\/.*?(?:[;,|]|$))|((?:file:\/\/)?.*?(?:[;,|]|$))/g)
          ?.map((item) => item.replace(/[;,|]$/g, ''))
          ?.filter((item) => item !== '') ?? [];

      const files = await Promise.all(items.map((url) => parseFile(url, proxyFunction)));
      const isError = files.some((file) => file === null);

      return { value: compact(files), isError };
    }
    default: {
      return { value: null, isError: true };
    }
  }
};

const fetchFile = async (url: string) => {
  const response = await fetch(url);
  return await response.blob();
};

const parseFile = async (url: string, request = fetchFile): Promise<XataFile | null> => {
  const uri = url.trim();
  try {
    if (uri.startsWith('data:')) {
      const [mediaType, base64Content] = uri.replace('data:', '').split(';base64,');
      return new XataFile({ base64Content, mediaType });
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const blob = await request(url);
      return XataFile.fromBlob(blob);
    } else {
      const [fs, path] = await Promise.all(['fs', 'path'].map((name) => import(name)));
      const filePath = path.resolve(uri.replace('file://', ''));
      const blob = new Blob([fs.readFileSync(filePath)], { type: 'application/octet-stream' });
      return XataFile.fromBlob(blob, { name: path.basename(filePath) });
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const coerceRows = async <T extends Record<string, unknown>>(
  rows: T[],
  columns: Schemas.Column[],
  options?: ColumnOptions
): Promise<Record<string, CoercedValue>[]> => {
  const mapped = [];
  for (const row of rows) {
    const entries = await Promise.all(
      columns.map((column) => coerceValue(row[column.name], column, options).then((value) => [column.name, value]))
    );
    mapped.push(Object.fromEntries(entries));
  }
  return mapped;
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
