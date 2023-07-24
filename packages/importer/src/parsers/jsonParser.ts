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
    return {
      data: row,
      original,
      index: index + startIndex
    };
  });

  return { success: true, columns, warnings: [], data };
};
