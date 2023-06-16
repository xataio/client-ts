import JSON from 'json5';
import CSV from 'papaparse';
import { coerceColumns, guessColumns } from './columns';
import { ImportCsvOptions, ImporterOptions, ImportJsonOptions, ImportNdJsonOptions, ParseResults } from './types';
import { detectNewline, isDefined, isObject } from './utils/lang';

export const DEFAULT_PARSE_SAMPLE_SIZE = 100;
export const DEFAULT_CSV_DELIMITERS_TO_GUESS = [',', '\t', '|', ';', '\x1E', '\x1F'];
export const DEFAULT_NULL_VALUES = [undefined, null, 'null', 'NULL', 'Null'];

export class Importer {
  read(options: ImporterOptions): ParseResults {
    switch (options.strategy) {
      case 'json':
        return this.#readJson(options);
      case 'ndjson':
        return this.#readNdJson(options);
      case 'csv':
        return this.#readCsv(options);
    }
  }

  #readCsv(options: ImportCsvOptions): ParseResults {
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

    const jsonResults = this.#readJson({
      ...rest,
      strategy: 'json',
      data: array
    });

    return jsonResults.success
      ? {
          ...jsonResults,
          warnings: [...parseWarnings, ...jsonResults.warnings]
        }
      : jsonResults;
  }

  #readNdJson(options: ImportNdJsonOptions): ParseResults {
    const { data, newline = detectNewline(data), ...rest } = options;

    const array = data.split(newline).map((line) => JSON.parse(line));

    return this.#readJson({ ...rest, strategy: 'json', data: array });
  }

  #readJson(options: ImportJsonOptions): ParseResults {
    const {
      data: input,
      tableName,
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

    return { success: true, table: { name: tableName, columns }, warnings: [], data };
  }
}
