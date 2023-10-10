import JSON from 'json5';
import { coerceRows, guessColumns } from '../columns';
import { ParseJsonOptions, ParseResults } from '../types';
import { isDefined, isObject, isXataFile, partition } from '../utils/lang';
import { Schemas } from '@xata.io/client';

const arrayToObject = (array: unknown[]) => {
  return Object.fromEntries(array.map((value, index) => [index, value]));
};

// Some columns need to be prepared before coercing the rows
const prepareColumns = (columns: Schemas.Column[], values: { data: Record<string, unknown> }[]): Schemas.Column[] => {
  return columns.map((column) => {
    switch (column.type) {
      case 'vector': {
        // We get the dimension from the first row
        const dimension = (values[0]?.data?.[column.name] as unknown[])?.length ?? 0;
        return { ...column, vector: { dimension } };
      }
      default:
        return column;
    }
  });
};

export const parseJson = async (options: ParseJsonOptions, startIndex = 0): Promise<ParseResults> => {
  const { data: input, columns: externalColumns, limit } = options;

  const array = Array.isArray(input) ? input : isObject(input) ? [input] : JSON.parse(input);

  const arrayUpToLimit = isDefined(limit) ? array.slice(0, limit) : array;
  const columnsGuessed = externalColumns ?? guessColumns(arrayUpToLimit, options);
  const item = await coerceRows(arrayUpToLimit, columnsGuessed, options);

  const data = item.map((row, index) => {
    const original = Array.isArray(arrayUpToLimit[index])
      ? arrayToObject(arrayUpToLimit[index])
      : arrayUpToLimit[index];

    const errorKeys = Object.entries(row)
      .filter(([_key, value]) => value.isError)
      .map(([key]) => key);

    const [files, data] = partition(
      Object.entries(row).map(([key, item]) => [key, item.value]),
      ([_key, value]) => isXataFile(value) || (Array.isArray(value) && value.some(isXataFile))
    );

    return {
      data: Object.fromEntries(data),
      files: Object.fromEntries(files),
      original,
      index: index + startIndex,
      errorKeys
    };
  });

  const columns = prepareColumns(columnsGuessed, data);

  return { success: true, columns, warnings: [], data };
};
