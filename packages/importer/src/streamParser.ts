import chunkArray from 'lodash.chunk';
import PQueue from 'p-queue';
import Papa, { Parser, ParseResult } from 'papaparse';
import { papaResultToJson, parseCsvOptionsToPapaOptions } from './parsers/csvParser';
import {
  CsvStreamParserOptions,
  OnBatchCallback,
  ParseCsvStreamOptions,
  ParseCsvStreamOptionsSync,
  ParseMeta,
  SyncCsvResults
} from './types';

const CHUNK_SIZE = 1024 * 1024 * 10; // 10MB

const metaToParseMeta = (meta: Papa.ParseMeta): Omit<ParseMeta, 'estimatedProgress'> => ({
  delimiter: meta.delimiter,
  linebreak: meta.linebreak,
  fields: meta.fields
});

// https://github.com/mholt/PapaParse/issues/708 passing preview param to papaparse loads entire file in the browser
export const parseCsvStream = async ({
  fileStream,
  parserOptions
}: ParseCsvStreamOptionsSync): Promise<SyncCsvResults> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      preview: parserOptions.limit,
      complete: (papaResults) => {
        const results = papaResultToJson(papaResults, parserOptions);
        resolve({ results, meta: { estimatedProgress: 1, ...metaToParseMeta(papaResults.meta) } });
      },
      error: (error) => reject(error)
    });
  });
};

export const parseCsvStreamBatches = async ({
  fileStream,
  fileSizeBytes,
  parserOptions,
  batchRowCount = 1000,
  batchSizeMin = 10,
  concurrentBatchMax = 5,
  onBatch = () => new Promise((resolve) => resolve())
}: ParseCsvStreamOptions): Promise<void> => {
  let rowCount = 0;
  let averageCursorPerRow = 0;
  let chunk: Papa.ParseResult<unknown> | null = null;
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      chunkSize: CHUNK_SIZE,
      chunk: async (result: ParseResult<unknown>, parser: Parser) => {
        if (!chunk) {
          chunk = result;
        } else {
          chunk.data.push(...result.data);
          chunk.meta = result.meta; // overwrite meta, probably ok?
          chunk.errors.push(...result.errors);
        }
        rowCount += result.data.length;
        averageCursorPerRow = result.meta.cursor / rowCount;
        if (chunk.data.length >= batchRowCount * batchSizeMin) {
          parser.pause();
          chunk = await processPapaChunk(
            chunk,
            parser,
            parserOptions,
            batchRowCount,
            averageCursorPerRow,
            fileSizeBytes,
            batchSizeMin,
            concurrentBatchMax,
            onBatch
          );
          parser.resume();
        }
      },
      complete: async () => {
        if (chunk) {
          await processPapaChunk(
            chunk,
            null,
            parserOptions,
            batchRowCount,
            averageCursorPerRow,
            fileSizeBytes,
            batchSizeMin,
            concurrentBatchMax,
            onBatch,
            true
          );
        }
        resolve();
      },
      error: (error) => reject(error)
    });
  });
};

const processChunk = async (
  data: unknown[],
  errors: Papa.ParseError[],
  meta: Papa.ParseMeta,
  parserOptions: CsvStreamParserOptions,
  parser: Papa.Parser | null,
  onChunk: OnBatchCallback,
  fileSizeBytes: number
) => {
  const results = papaResultToJson({ data, errors, meta: meta }, parserOptions);
  const estimatedProgress = meta.cursor / fileSizeBytes;

  try {
    await onChunk(results, { estimatedProgress, ...metaToParseMeta(meta) });
  } catch (error) {
    // the user can throw an error to abort processing the file
    parser?.abort();
    throw error;
  }
};

const calcAmountToProcess = (
  chunk: Papa.ParseResult<unknown>,
  chunkRowCount: number,
  forceFinish: boolean,
  onChunkConcurrentMin: number
) => {
  if (forceFinish) {
    return chunk.data.length;
  }
  const chunks = Math.floor(chunk.data.length / chunkRowCount);
  if (chunks < onChunkConcurrentMin) {
    return 0;
  }
  return chunks * chunkRowCount;
};

const processPapaChunk = async (
  papaChunk: Papa.ParseResult<unknown>,
  parser: Papa.Parser | null,
  parserOptions: CsvStreamParserOptions,
  chunkRowCount: number,
  averageCursorPerRow: number,
  fileSizeBytes: number,
  onChunkBatchSizeMin: number,
  onChunkConcurrentMax: number,
  onChunk: OnBatchCallback,
  forceFinish = false
): Promise<Papa.ParseResult<unknown>> => {
  const amountToProcess = calcAmountToProcess(papaChunk, chunkRowCount, forceFinish, onChunkBatchSizeMin);

  if (amountToProcess <= 0) {
    return papaChunk;
  }
  const data = papaChunk.data.splice(0, amountToProcess);
  const errors = papaChunk.errors.splice(0, amountToProcess);
  const chunks = chunkArray(data, chunkRowCount);
  const promises = chunks.map((chunkData, index) => {
    const estimatedCursor = Math.floor(papaChunk.meta.cursor + averageCursorPerRow * chunkData.length * index);
    return () =>
      processChunk(
        chunkData,
        errors,
        { ...papaChunk.meta, cursor: estimatedCursor },
        parserOptions,
        parser,
        onChunk,
        fileSizeBytes
      );
  });
  const queue = new PQueue({ concurrency: onChunkConcurrentMax, carryoverConcurrencyCount: true });
  await queue.addAll(promises);
  return papaChunk;
};
