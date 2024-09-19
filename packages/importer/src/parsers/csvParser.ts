import { pick } from 'lodash';
import CSV, { ParseConfig } from 'papaparse';
import { ParseCsvOptions, ParseMeta, ParseResults } from '../types';
import { parseJson } from './jsonParser';

export const DEFAULT_CSV_DELIMITERS_TO_GUESS = [',', '\t', '|', ';', '\x1E', '\x1F'];

// https://github.com/sindresorhus/strip-bom/blob/main/index.js
const stripBom = (string: string) => {
  if (typeof string !== 'string') {
    throw new TypeError(`Expected a string, got ${typeof string}`);
  }
  // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
  // conversion translates it to FEFF (UTF-16 BOM).
  if (string.charCodeAt(0) === 0xfeff) {
    return string.slice(1);
  }
  return string;
};

export const metaToParseMeta = (meta: Papa.ParseMeta): Omit<ParseMeta, 'estimatedProgress' | 'rowIndex'> => ({
  delimiter: meta.delimiter,
  linebreak: meta.linebreak,
  fields: meta.fields
});

export const parseCsvOptionsToPapaOptions = (options: ParseCsvOptions): ParseConfig => {
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
    comments: commentPrefix,
    transformHeader(header) {
      return stripBom(header);
    }
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

export const papaResultToJson = async (
  { data, errors }: CSV.ParseResult<unknown>,
  options: ParseCsvOptions,
  startIndex = 0
): Promise<ParseResults> => {
  const parseWarnings = errors.map((error) => error.message);

  const jsonResults = await parseJson(
    {
      ...options,
      data: dataForColumns(data, options.columns)
    },
    startIndex
  );

  return jsonResults.success
    ? {
        ...jsonResults,
        warnings: [...parseWarnings, ...jsonResults.warnings]
      }
    : jsonResults;
};
