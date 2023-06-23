import Papa, { Parser, ParseResult } from 'papaparse';
import { papaResultToJson, parseCsvOptionsToPapaOptions } from './parser';
import {
  CsvStreamParserOptions,
  ParseCsvStreamOptions,
  ParseCsvStreamOptionsSync,
  ParseMeta,
  ParseResults
} from './types';

const CHUNK_SIZE = 1024 * 1024 * 10; // 10MB

// todo this function needs to return delimiters and other CSV settings
// https://github.com/mholt/PapaParse/issues/708 passing preview param to papaparse loads entire file in the browser
export const parseCsvFileStreamSync = async ({
  fileStream,
  parserOptions
}: ParseCsvStreamOptionsSync): Promise<ParseResults> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      preview: parserOptions.limit,
      complete: (results) => resolve(papaResultToJson(results, parserOptions)),
      error: (error) => reject(error)
    });
  });
};

// todo: parserOptions.columns required
export const parseCsvFileStream = async ({
  fileStream,
  fileSizeBytes,
  parserOptions,
  chunkRowCount = 1000,
  onChunkConcurrentMax = 2,
  onChunk = () => new Promise((resolve) => resolve())
}: ParseCsvStreamOptions): Promise<void> => {
  let onChunkConcurrentCount = 0;
  let chunk: Papa.ParseResult<unknown> | null = null;
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      chunkSize: CHUNK_SIZE,
      chunk: async (result: ParseResult<unknown>, parser: Parser) => {
        // todo: make this single threaded, but keep batch import multi-threaded?
        if (!chunk) {
          chunk = result;
        } else {
          chunk.data = chunk.data.concat(result.data); // concat inefficient?
          chunk.meta = result.meta; // overwrite meta, probably ok?
          chunk.errors = chunk.errors.concat(result.errors); // concat inefficient?
        }
        if (onChunkConcurrentCount >= onChunkConcurrentMax) {
          parser.pause();
        }
        onChunkConcurrentCount++;
        chunk = await processChunk(chunk, parser, parserOptions, chunkRowCount, fileSizeBytes, onChunk);
        onChunkConcurrentCount--;
        parser.resume();
      },
      complete: async () => {
        if (chunk) {
          await processChunk(chunk, null, parserOptions, chunkRowCount, fileSizeBytes, onChunk, true);
        }
        resolve();
      },
      error: (error) => reject(error)
    });
  });
};

const processChunk = async (
  chunk: Papa.ParseResult<unknown>,
  parser: Papa.Parser | null,
  parserOptions: CsvStreamParserOptions,
  chunkRowCount: number,
  fileSizeBytes: number,
  onChunk: (parseResults: ParseResults, meta: ParseMeta) => Promise<void>,
  forceFinish = false
): Promise<Papa.ParseResult<unknown>> => {
  if (chunk.data.length === 0 || (!forceFinish && chunk.data.length < chunkRowCount)) {
    return chunk;
  }
  const data = chunk.data.splice(0, chunkRowCount);
  const errors = chunk.errors.splice(0, chunkRowCount);
  const results = papaResultToJson({ data, errors, meta: chunk.meta }, parserOptions);
  const estimatedProgress = chunk.meta.cursor / fileSizeBytes;

  try {
    // todo: estimatedProgress isn't working well
    await onChunk(results, { estimatedProgress });
  } catch (error) {
    // the user can throw an error to abort processing the file
    parser?.abort();
    throw error;
  }

  return processChunk(chunk, parser, parserOptions, chunkRowCount, fileSizeBytes, onChunk);
};
