import { Schemas } from '@xata.io/client';

export type ImporterOptions = ImportCsvOptions | ImportJsonOptions | ImportFileOptions | ImportNdJsonOptions;

export type ImporterStrategy = ImporterOptions['strategy'];

type File = { fileName: string; content: string };

export interface ImportCommonOptions {
  /**
   * The schema to use for importing data.
   * If not provided, the schema will be guessed from the data.
   * If provided, the data will be coerced to the schema.
   */
  schema?: Schemas.Schema;
  /**
   * Limit the number of rows to import.
   * @default // no limit
   * @min 1
   */
  limit?: number;
  /**
   * The values to interpret as null.
   */
  nullValues?: string[];
}

export interface ImportCsvOptions extends ImportCommonOptions {
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

export interface ImportJsonOptions extends ImportCommonOptions {
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

export interface ImportFileOptions extends ImportCommonOptions {
  /**
   * The strategy to use for importing data.
   */
  strategy: 'file';
  /**
   * The files to import.
   * The file name will be used as the table name.
   */
  files: File[];
  /**
   * Additional options to pass to the parser.
   */
  parserOptions?: {
    /**
     * CSV parser options.
     */
    csv?: Omit<ImportCsvOptions, 'strategy' | 'data' | 'tableName'>;
    /**
     * JSON parser options.
     */
    json?: Omit<ImportJsonOptions, 'strategy' | 'data' | 'tableName'>;
  };
}

export interface ImportNdJsonOptions extends ImportCommonOptions {
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
      schema: Schemas.Schema;
      warnings: string[];
      data: unknown[];
    }
  | { success: false; errors: string[] };
