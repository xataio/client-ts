import JSON from 'json5';
import CSV from 'papaparse';
import { z } from 'zod';
import { coerceSchema, guessSchema } from './schema';
import {
  ImportCsvOptions,
  ImporterOptions,
  ImportFileOptions,
  ImportJsonOptions,
  ImportNdJsonOptions,
  ImportUrlOptions,
  ParseResults
} from './types';
import { detectNewline, isObject } from './utils/lang';
import { schemaToZod } from './zod';

export const DEFAULT_PARSE_SAMPLE_SIZE = 100;
export const DEFAULT_DELIMITERS_TO_GUESS = [',', '\t', '|', ';', '\x1E', '\x1F'];
export const DEFAULT_NULL_VALUES = [undefined, null, 'null', 'NULL', 'Null'];

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

  async #readFile(_options: ImportFileOptions): Promise<ParseResults> {
    return { success: true, schema: { tables: [] }, warnings: [], data: [] };
  }

  async #readUrl(_options: ImportUrlOptions): Promise<ParseResults> {
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
