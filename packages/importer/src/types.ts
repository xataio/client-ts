import { Schemas } from '@xata.io/client';

type Column = Schemas.Column;

export type ParseOptions = ParseCsvOptions | ParseJsonOptions | ParseNdJsonOptions;

export type ParseStrategy = ParseOptions['strategy'];

export interface ParseCommonOptions {
  /**
   * The schema of the columns to use for importing data.
   * If not provided, the columns will be guessed from the data.
   * If provided, the data will be coerced to the column types.
   */
  columns?: Column[];
  /**
   * Limit the number of rows to import.
   * @default // no limit
   * @min 1
   */
  limit?: number;

  /**
   * Number of rows to use to guess the schema
   */
  previewLimit?: number;
  /**
   * The values to interpret as null.
   */
  nullValues?: string[];
}

export interface ParseCsvOptions extends ParseCommonOptions {
  /**
   * The strategy to use for importing data.
   */
  strategy: 'csv';
  /**
   * The name of the table to import the data into.
   */
  tableName: string;
  /**
   * The CSV string data to parse.
   */
  data: string;
  /**
   * The delimiting character.
   * Leave blank to auto-detect from a list of most common delimiters, or any values passed in through `delimitersToGuess`.
   * Multi-character delimiters are supported.
   */
  delimiter?: string;
  /**
   * An array of delimiters to guess from if the delimiter option is not set.
   * @default [',', '\t', '|', ';', '\x1E', '\x1F']
   */
  delimitersToGuess?: string[];
  /**
   * If `true`, the first row of parsed data will be interpreted as field names.
   * Warning: Duplicate field names will overwrite values in previous fields having the same name.
   * @default true
   */
  header?: boolean;
  /**
   * If `true`, lines that are completely empty (those which evaluate to an empty string) will be skipped.
   * @default true
   */
  skipEmptyLines?: boolean;
  /**
   * The newline sequence. Leave blank to auto-detect. Must be one of `\r`, `\n`, or `\r\n`.
   * @default // auto-detect
   */
  newline?: '\r' | '\n' | '\r\n';
  /**
   * The character used to quote fields. The quoting of all fields is not mandatory. Any field which is not quoted will correctly read.
   * @default '"'
   */
  quoteChar?: string;
  /**
   * The character used to escape the quote character within a field.
   * If not set, this option will default to the value of `quoteChar`,
   * meaning that the default escaping of quote character within a quoted field is using the quote character two times.
   * (e.g. `"column with ""quotes"" in text"`)
   * @default '"'
   */
  escapeChar?: string;
  /**
   * A string that indicates a comment (for example, "#" or "//").
   * When we encounter a line starting with this string, it will skip the line.
   * @default // none
   */
  commentPrefix?: string;
}

export interface ParseJsonOptions extends ParseCommonOptions {
  /**
   * The strategy to use for importing data.
   */
  strategy: 'json';
  /**
   * The name of the table to import the data into.
   */
  tableName: string;
  /**
   * The JSON string data to parse.
   * If the data is an array, it will be interpreted as an array of objects.
   * If the data is an object, it will be interpreted as a single object.
   */
  data: string | unknown[] | Record<string, unknown>;
}

export interface ParseFileStreamOptions extends ParseCommonOptions {
  /**
   * The strategy to use for importing data.
   */
  strategy: 'file';
  /**
   * The file to import.
   */
  // todo: should/could this be a stream? alexis: node stream or v8 stream.
  filePath: string;
  /**
   * Additional options to pass to the parser.
   */
  parserOptions?: {
    /**
     * CSV parser options.
     */
    csv?: Omit<ParseCsvOptions, 'strategy' | 'data'>;
    /**
     * JSON parser options.
     */
    ndjson?: Omit<ParseNdJsonOptions, 'strategy' | 'data'>;
  };
}

export interface ParseNdJsonOptions extends ParseCommonOptions {
  /**
   * The strategy to use for importing data.
   */
  strategy: 'ndjson';
  /**
   * The name of the table to import the data into.
   */
  tableName: string;
  /**
   * The NDJSON string data to parse.
   */
  data: string;
  /**
   * The newline sequence. Leave blank to auto-detect. Must be one of `\r`, `\n`, or `\r\n`.
   * @default // auto-detect
   */
  newline?: '\r' | '\n' | '\r\n';
}

export type ParseResults =
  | {
      success: true;
      table: Schemas.Table;
      warnings: string[];
      data: unknown[];
    }
  | { success: false; errors: string[] };

export type ParseStreamResponse = {
  getNextRows: (numberOfRows: number) => ParseResults;
  table: Schemas.Table;
};

export type ParseStreamOptions = ParseStreamResponse & {
  batchSize: number;
  // todo factor out error type
  onBatchProcessed: (params: {
    batch: ParseResults;
    errors: { index: number; error: string }[];
    stop: () => void;
  }) => void;
};
