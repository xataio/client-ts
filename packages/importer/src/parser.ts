import JSON from 'json5';
import CSV from 'papaparse';
import { coerceColumns, guessColumns } from './columns';
import { ParseCsvOptions, ParseJsonOptions, ParseNdJsonOptions, ParseResults } from './types';
import { detectNewline, isDefined, isObject } from './utils/lang';

export const DEFAULT_PARSE_SAMPLE_SIZE = 100;
export const DEFAULT_CSV_DELIMITERS_TO_GUESS = [',', '\t', '|', ';', '\x1E', '\x1F'];
export const DEFAULT_NULL_VALUES = [undefined, null, 'null', 'NULL', 'Null'];

export const parseCsv = (options: ParseCsvOptions): ParseResults => {
  const {
    data,
    limit,
    delimiter,
    header = true,
    skipEmptyLines = true,
    delimitersToGuess = DEFAULT_CSV_DELIMITERS_TO_GUESS,
    newline,
    quoteChar = '"',
    escapeChar = '"',
    commentPrefix,
    ...rest
  } = options;

  const { data: array, errors: parseErrors } = CSV.parse(data, {
    header,
    skipEmptyLines,
    preview: limit,
    delimiter,
    delimitersToGuess,
    newline,
    quoteChar,
    escapeChar,
    comments: commentPrefix
  });

  const parseWarnings = parseErrors.map((error) => error.message);

  const jsonResults = parseJson({
    ...rest,
    data: array
  });

  return jsonResults.success
    ? {
        ...jsonResults,
        warnings: [...parseWarnings, ...jsonResults.warnings]
      }
    : jsonResults;
};

export const parseNdJson = (options: ParseNdJsonOptions): ParseResults => {
  const { data, newline = detectNewline(data), ...rest } = options;

  const array = data.split(newline).map((line) => JSON.parse(line));

  return parseJson({ ...rest, data: array });
};

export const parseJson = (options: ParseJsonOptions): ParseResults => {
  const {
    data: input,
    columns: externalColumns,
    previewLimit = DEFAULT_PARSE_SAMPLE_SIZE,
    limit,
    nullValues = DEFAULT_NULL_VALUES //todo: do we need this?
  } = options;

  const array = Array.isArray(input) ? input : isObject(input) ? [input] : JSON.parse(input);

  const previewData = array.slice(0, previewLimit);
  const columns = externalColumns ?? guessColumns(previewData, nullValues);
  const arrayUpToLimit = isDefined(limit) ? array.slice(0, limit) : array;
  const data = coerceColumns(columns, arrayUpToLimit, nullValues);

  return { success: true, columns, warnings: [], data };
};
