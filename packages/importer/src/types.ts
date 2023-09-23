import { XataFile } from '@xata.io/client';
import { Schemas } from '@xata.io/client';
import stream from 'stream';

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

type Column = Schemas.Column;

export type ToBoolean = (value: unknown) => boolean | null;

export type ColumnOptions = {
  /**
   * A function to check if a value is null.
   */
  isNull?: (value: unknown) => boolean;

  /**
   * A function to convert a value to a boolean. Should return true, false or null (not a boolean).
   */
  toBoolean?: ToBoolean;
};

export type ParseCommonOptions = {
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
} & ColumnOptions;

export type ParseCsvOptions = ParseCommonOptions & {
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
};

export type ParseJsonOptions = ParseCommonOptions & {
  /**
   * The JSON string data to parse.
   * If the data is an array, it will be interpreted as an array of objects.
   * If the data is an object, it will be interpreted as a single object.
   */
  data: string | unknown[] | Record<string, unknown>;
};

export type OnBatchCallback = (parseResults: ParseResults, meta: ParseMeta) => Promise<void>;

export interface ParseStreamOptions<ParserOptions> {
  /**
   * The file to import.
   */
  fileStream: stream.Readable | File;

  /**
   * Additional options to pass to the parser.
   */
  parserOptions: ParserOptions;
}

export type ParseCsvStreamOptions = ParseStreamOptions<ParseCsvOptions>;

export type ParseCsvStreamBatchesOptions = {
  /**
   * The number of rows in a batch.
   * @default 1000
   */
  batchRowCount?: number;

  /**
   * The minimum number of rows for the csv parser to collect before processing batches.
   * @default 10
   */
  batchSizeMin?: number;

  /**
   * The maximum number of `onBatch` callbacks to run concurrently.
   * @default 5
   */
  concurrentBatchMax?: number;

  /**
   * Callback to run for each batch.
   */
  onBatch?: OnBatchCallback;

  /**
   * file size in bytes. Used to estimate progress
   */
  fileSizeBytes: number;
} & ParseStreamOptions<WithRequired<ParseCsvOptions, 'columns'>>;

export type ImportFilesOptions = {
  table: string;
  ids: string[];
  files: ParseResultData['files'];
};
export type ParseMeta = {
  estimatedProgress: number;
  delimiter: string;
  linebreak: string;
  fields: string[] | undefined;
  rowIndex: number;
};

export type ParseResultData = {
  data: Record<string, unknown>;
  files: Record<string, XataFile | XataFile[]>;
  original: unknown;
  index: number;
  errorKeys: string[];
};

export type ParseResults =
  | {
      success: true;
      columns: Column[];
      warnings: string[];
      data: ParseResultData[];
    }
  | { success: false; errors: string[] };

export type CsvResults = {
  results: ParseResults;
  meta: ParseMeta;
};

export type ImportBatchOptions = {
  columns: Column[];
  table: string;
  batchRows: unknown[];
};

export type ImportError = { row: unknown; error: string; index: number };
