import { SQLQuery } from '.';
import { isDefined, isObject, isStringArray } from '../util/lang';

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

export function prepareParams(param1: SQLQuery, param2?: any[]) {
  if (isStringArray(param1)) {
    const query = param1.reduce((acc, str, i) => {
      return acc + str + (i < param1.length - 1 ? `$${i + 1}` : '');
    });

    return { query, params: param2?.map((value) => prepareValue(value)) };
  }

  if (isObject(param1)) {
    const { query, params, consistency } = param1;

    return { query, params: params.map((value) => prepareValue(value)), consistency };
  }

  throw new Error('Invalid query');
}
