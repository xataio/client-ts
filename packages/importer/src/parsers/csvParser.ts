import pick from 'lodash.pick';
import CSV from 'papaparse';
import { ParseCsvOptions, ParseResults } from '../types';
import { parseJson } from './jsonParser';

export const DEFAULT_CSV_DELIMITERS_TO_GUESS = [',', '\t', '|', ';', '\x1E', '\x1F'];

export const parseCsvOptionsToPapaOptions = (options: Omit<ParseCsvOptions, 'data'>) => {
  const {
    limit,
    delimiter,
    header = true,
    skipEmptyLines = true,
    delimitersToGuess = DEFAULT_CSV_DELIMITERS_TO_GUESS,
    newline,
    quoteChar = '"',
    escapeChar = '"',
    commentPrefix
  } = options;
  return {
    header,
    skipEmptyLines,
    preview: limit,
    delimiter,
    delimitersToGuess,
    newline,
    quoteChar,
    escapeChar,
    comments: commentPrefix
  };
};

const dataForColumns = (data: unknown[], columns: ParseCsvOptions['columns']) => {
  if (!columns) {
    return data;
  }
  return data.map((d) =>
    pick(
      d,
      columns.map((col) => col.name)
    )
  );
};

export const papaResultToJson = (
  { data, errors }: CSV.ParseResult<unknown>,
  options: Omit<ParseCsvOptions, 'data'>
): ParseResults => {
  const parseWarnings = errors.map((error) => error.message);

  const jsonResults = parseJson({
    ...options,
    data: dataForColumns(data, options.columns)
  });

  return jsonResults.success
    ? {
        ...jsonResults,
        warnings: [...parseWarnings, ...jsonResults.warnings]
      }
    : jsonResults;
};
