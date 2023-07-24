import JSON from 'json5';
import { coerceRows, guessColumns } from '../columns';
import { ParseJsonOptions, ParseResults } from '../types';
import { isDefined, isObject } from '../utils/lang';

const arrayToObject = (array: unknown[]) => {
  return Object.fromEntries(array.map((value, index) => [index, value]));
};

export const parseJson = (options: ParseJsonOptions, startIndex = 0): ParseResults => {
  const { data: input, columns: externalColumns, limit } = options;

  const array = Array.isArray(input) ? input : isObject(input) ? [input] : JSON.parse(input);

  const arrayUpToLimit = isDefined(limit) ? array.slice(0, limit) : array;
  const columns = externalColumns ?? guessColumns(arrayUpToLimit, options);
  const data = coerceRows(arrayUpToLimit, columns, options).map((row, index) => {
    const original = Array.isArray(arrayUpToLimit[index])
      ? arrayToObject(arrayUpToLimit[index])
      : arrayUpToLimit[index];

    const errorKeys = Object.entries(row)
      .filter(([_key, value]) => value.isError)
      .map(([key]) => key);
    console.log('zzz errorKeys', errorKeys);
    const data = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value.value]));
    return {
      data,
      original,
      index: index + startIndex,
      errorKeys
    };
  });

  return { success: true, columns, warnings: [], data };
};
