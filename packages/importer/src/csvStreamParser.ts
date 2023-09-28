import chunkArray from 'lodash.chunk';
import PQueue from 'p-queue';
import Papa, { Parser, ParseResult } from 'papaparse';
import { metaToParseMeta, papaResultToJson, parseCsvOptionsToPapaOptions } from './parsers/csvParser';
import {
  CsvResults,
  OnBatchCallback,
  ParseCsvOptions,
  ParseCsvStreamBatchesOptions,
  ParseCsvStreamOptions
} from './types';
import { isDefined } from './utils/lang';

const CHUNK_SIZE = 1024 * 1024 * 10; // 10MB

// https://github.com/mholt/PapaParse/issues/708 passing preview param to papaparse loads entire file in the browser
export const parseCsvStream = async ({ fileStream, parserOptions }: ParseCsvStreamOptions): Promise<CsvResults> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      complete: async (papaResults) => {
        const results = await papaResultToJson(papaResults, parserOptions);
        resolve({ results, meta: { estimatedProgress: 1, rowIndex: 0, ...metaToParseMeta(papaResults.meta) } });
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
}: ParseCsvStreamBatchesOptions): Promise<void> => {
  let rowCount = 0;
  let lastChunkProcessedRowCount = 0;
  let averageCursorPerRow = 0;
  let chunk: Papa.ParseResult<unknown> | null = null;
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      chunkSize: CHUNK_SIZE,
      chunk: async (result: ParseResult<unknown>, parser: Parser) => {
        try {
          if (!chunk) {
            chunk = result;
          } else {
            // cannot use push(...result.data) because stack size might be exceeded https://stackoverflow.com/a/61740952
            for (const item of result.data) {
              chunk.data.push(item);
            }
            chunk.meta = result.meta; // overwrite meta to be latest meta
            for (const error of result.errors) {
              chunk.errors.push(error);
            }
          }
          const oldRowCount = rowCount;
          rowCount += result.data.length;
          averageCursorPerRow = result.meta.cursor / rowCount;

          // Only stop papaparse from parsing the file if we have enough data to process
          if (chunk.data.length >= batchRowCount * batchSizeMin) {
            parser.pause();
            chunk = await processPapaChunk({
              papaChunk: chunk,
              parser,
              parserOptions,
              batchRowCount,
              averageCursorPerRow,
              fileSizeBytes,
              batchSizeMin,
              concurrentBatchMax,
              onBatch,
              startRowIndex: lastChunkProcessedRowCount
            });
            lastChunkProcessedRowCount = oldRowCount;
            parser.resume();
          }
        } catch (error) {
          reject(error);
          // abort after reject to avoid `complete` callback being called
          parser.abort();
        }
      },
      complete: async () => {
        try {
          if (chunk) {
            await processPapaChunk({
              papaChunk: chunk,
              parserOptions,
              batchRowCount,
              averageCursorPerRow,
              fileSizeBytes,
              batchSizeMin,
              concurrentBatchMax,
              onBatch,
              forceFinish: true,
              startRowIndex: rowCount - chunk.data.length
            });
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
};

const processBatch = async ({
  data,
  errors,
  meta,
  parserOptions,
  parser,
  onBatch,
  fileSizeEstimateBytes,
  startRowIndex
}: {
  data: unknown[];
  errors: Papa.ParseError[];
  meta: Papa.ParseMeta;
  parserOptions: ParseCsvOptions;
  parser?: Papa.Parser;
  onBatch: OnBatchCallback;
  fileSizeEstimateBytes: number;
  startRowIndex: number;
}) => {
  const results = await papaResultToJson({ data, errors, meta: meta }, parserOptions, startRowIndex);
  const estimatedProgress = meta.cursor / fileSizeEstimateBytes;

  try {
    await onBatch(results, { estimatedProgress, rowIndex: startRowIndex, ...metaToParseMeta(meta) });
  } catch (error) {
    // the user can throw an error to abort processing the file
    parser?.abort();
    throw error;
  }
};

const calcAmountToProcess = (
  chunk: Papa.ParseResult<unknown>,
  batchRowCount: number,
  forceFinish: boolean,
  batchSizeMin: number
) => {
  if (forceFinish) {
    return chunk.data.length;
  }
  const chunks = Math.floor(chunk.data.length / batchRowCount);
  if (chunks < batchSizeMin) {
    return 0;
  }
  return chunks * batchRowCount;
};

const processPapaChunk = async ({
  papaChunk,
  parser,
  parserOptions,
  batchRowCount,
  averageCursorPerRow,
  fileSizeBytes,
  batchSizeMin,
  concurrentBatchMax,
  onBatch,
  forceFinish = false,
  startRowIndex
}: {
  papaChunk: Papa.ParseResult<unknown>;
  parser?: Papa.Parser;
  parserOptions: ParseCsvOptions;
  batchRowCount: number;
  averageCursorPerRow: number;
  fileSizeBytes: number;
  batchSizeMin: number;
  concurrentBatchMax: number;
  onBatch: OnBatchCallback;
  forceFinish?: boolean;
  startRowIndex: number;
}): Promise<Papa.ParseResult<unknown>> => {
  const amountToProcess = calcAmountToProcess(papaChunk, batchRowCount, forceFinish, batchSizeMin);

  if (amountToProcess <= 0) {
    return papaChunk;
  }
  const data = papaChunk.data.splice(0, amountToProcess);
  const errors = papaChunk.errors.splice(0, amountToProcess);
  const batches: unknown[][] = chunkArray(data, batchRowCount);
  const promises = batches.map((batchData, index) => {
    // cursor is how far through the file we are. Here we interpolate the cursor for the batches we are processing
    const rowsSoFar = batchData.length + batchRowCount * index; //batchData.length and batchRowCount can be different
    const rowsFromEnd = data.length - rowsSoFar;
    const estimatedCursor = Math.floor(papaChunk.meta.cursor - averageCursorPerRow * rowsFromEnd);
    const fileSizeEstimateBytes = isDefined(parserOptions.limit)
      ? averageCursorPerRow * parserOptions.limit
      : fileSizeBytes;
    return () =>
      processBatch({
        data: batchData,
        errors,
        meta: { ...papaChunk.meta, cursor: estimatedCursor },
        parserOptions,
        parser,
        onBatch,
        fileSizeEstimateBytes,
        startRowIndex: startRowIndex + batchRowCount * index
      });
  });
  const queue = new PQueue({ concurrency: concurrentBatchMax, carryoverConcurrencyCount: true });
  await queue.addAll(promises);
  return papaChunk;
};
