import CSV from 'papaparse';
import JSON from 'json5';
import type { Schemas } from '@xata.io/client';
import { coerceSchema, guessSchema } from './schema';
import { schemaToZod } from './zod';
import { z } from 'zod';
import { detectNewline, isObject } from './utils/lang';

const DEFAULT_PARSE_SAMPLE_SIZE = 100;
const DEFAULT_DELIMITERS_TO_GUESS = [',', '\t', '|', ';', '\x1E', '\x1F'];
const DEFAULT_NULL_VALUES = [undefined, null, 'null', 'NULL', 'Null'];

export type ImporterOptions =
  | ImportCsvOptions
  | ImportJsonOptions
  | ImportFileOptions
  | ImportUrlOptions
  | ImportNdJsonOptions;

export type ImporterStrategy = ImporterOptions['strategy'];

// TODO: Improve this type
type File = any;

interface ImportCommonOptions {
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

interface ImportCsvOptions extends ImportCommonOptions {
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

interface ImportJsonOptions extends ImportCommonOptions {
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

interface ImportFileOptions extends ImportCommonOptions {
  /**
   * The strategy to use for importing data.
   */
  strategy: 'file';
  /**
   * The files to import.
   * The file name will be used as the table name.
   */
  files: File[];
}

interface ImportUrlOptions extends ImportCommonOptions {
  /**
   * The strategy to use for importing data.
   */
  strategy: 'url';
  /**
   * The URLs to import.
   */
  urls: string[];
}

interface ImportNdJsonOptions extends ImportCommonOptions {
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

type ParseResults =
  | {
      success: true;
      schema: Schemas.Schema;
      warnings: string[];
      data: unknown[];
    }
  | { success: false; errors: string[] };

export class Importer {
  async read(options: ImporterOptions): Promise<ParseResults> {
    switch (options.strategy) {
      case 'file':
        return await this.#readFile(options);
      case 'url':
        return await this.#readUrl(options);
      case 'json':
        return await this.#readJson(options);
      case 'ndjson':
        return await this.#readNdJson(options);
      case 'csv':
        return await this.#readCsv(options);
    }
  }

  async import(options: ImporterOptions) {
    // noop
  }

  async #readFile(options: ImportFileOptions): Promise<ParseResults> {
    return { success: true, schema: { tables: [] }, warnings: [], data: [] };
  }

  async #readUrl(options: ImportUrlOptions): Promise<ParseResults> {
    return { success: true, schema: { tables: [] }, warnings: [], data: [] };
  }

  async #readCsv(options: ImportCsvOptions): Promise<ParseResults> {
    const {
      data,
      limit,
      delimiter,
      header = true,
      skipEmptyLines = true,
      delimitersToGuess = DEFAULT_DELIMITERS_TO_GUESS,
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

    const jsonResults = await this.#readJson({
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

  async #readNdJson(options: ImportNdJsonOptions): Promise<ParseResults> {
    const { data, newline = detectNewline(data), ...rest } = options;

    const array = data.split(newline).map((line) => JSON.parse(line));

    return await this.#readJson({ ...rest, strategy: 'json', data: array });
  }

  async #readJson(options: ImportJsonOptions): Promise<ParseResults> {
    const {
      data: input,
      tableName,
      schema: externalSchema,
      limit = DEFAULT_PARSE_SAMPLE_SIZE,
      nullValues = DEFAULT_NULL_VALUES
    } = options;

    const array = Array.isArray(input) ? input : isObject(input) ? [input] : JSON.parse(input);

    const previewData = array.slice(0, limit);
    const schema = externalSchema ?? guessSchema(tableName, previewData, nullValues);
    const data = coerceSchema(schema, previewData, nullValues);

    const validation = await z.array(schemaToZod(schema)[tableName]).safeParseAsync(data);

    const warnings = validation.success ? [] : validation.error.issues.map((issue) => issue.message);

    return { success: true, schema, warnings, data };
  }
}
