import JSON from 'json5';
import { coerceRows, guessColumns } from '../columns';
import { ParseJsonOptions, ParseResults } from '../types';
import { isDefined, isObject } from '../utils/lang';

export const parseJson = (options: ParseJsonOptions): ParseResults => {
  const { data: input, columns: externalColumns, limit } = options;

  const array = Array.isArray(input) ? input : isObject(input) ? [input] : JSON.parse(input);

  const arrayUpToLimit = isDefined(limit) ? array.slice(0, limit) : array;
  const columns = externalColumns ?? guessColumns(arrayUpToLimit, options);
  const data = coerceRows(arrayUpToLimit, columns, options);

  return { success: true, columns, warnings: [], data };
};
