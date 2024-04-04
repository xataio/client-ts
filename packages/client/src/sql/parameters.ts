import { SQLQuery } from '.';
import { isDefined, isObject, isString, isStringArray } from '../util/lang';
import { Buffer } from '../util/buffer';

function escapeElement(elementRepresentation: string) {
  const escaped = elementRepresentation.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  return '"' + escaped + '"';
}

function arrayString<T extends any[]>(val: T) {
  let result = '{';
  for (let i = 0; i < val.length; i++) {
    if (i > 0) {
      result = result + ',';
    }
    if (val[i] === null || typeof val[i] === 'undefined') {
      result = result + 'NULL';
    } else if (Array.isArray(val[i])) {
      result = result + arrayString(val[i]);
    } else if (val[i] instanceof Buffer) {
      result += '\\\\x' + val[i].toString('hex');
    } else {
      result += escapeElement(prepareValue(val[i]));
    }
  }
  result = result + '}';
  return result;
}

// Code distilled from pg/lib/utils.js
function prepareValue(value: unknown) {
  // null and undefined are both NULL in postgres
  if (!isDefined(value)) return null;

  // Convert JS Date to Postgres timestamp type
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Convert arrays to postgres array syntax
  if (Array.isArray(value)) {
    return arrayString(value);
  }

  // Convert objects to JSON strings
  if (isObject(value)) {
    return JSON.stringify(value);
  }

  try {
    // @ts-expect-error - Unknown type, attempt to coerce to string
    return value.toString();
  } catch (e) {
    return value;
  }
}

export function prepareParams(param1: SQLQuery | string, param2?: any[]) {
  if (isString(param1)) {
    return { statement: param1, params: param2?.map((value) => prepareValue(value)) };
  }

  if (isStringArray(param1)) {
    const statement = param1.reduce((acc, curr, index) => {
      return acc + curr + (index < (param2?.length ?? 0) ? '$' + (index + 1) : '');
    }, '');

    return { statement, params: param2?.map((value) => prepareValue(value)) };
  }

  if (isObject(param1)) {
    const { statement, params, consistency, responseType } = param1;

    return { statement, params: params?.map((value) => prepareValue(value)), consistency, responseType };
  }

  throw new Error('Invalid query');
}
