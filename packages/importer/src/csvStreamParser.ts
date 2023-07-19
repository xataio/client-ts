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
}: ParseCsvStreamBatchesOptions): Promise<void> => {
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
          chunk.meta = result.meta; // overwrite meta to be latest meta
          chunk.errors.push(...result.errors);
        }
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
            onBatch
          });
          parser.resume();
        }
      },
      complete: async () => {
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
            forceFinish: true
          });
        }
        resolve();
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
  fileSizeEstimateBytes
}: {
  data: unknown[];
  errors: Papa.ParseError[];
  meta: Papa.ParseMeta;
  parserOptions: ParseCsvOptions;
  parser?: Papa.Parser;
  onBatch: OnBatchCallback;
  fileSizeEstimateBytes: number;
}) => {
  const results = papaResultToJson({ data, errors, meta: meta }, parserOptions);
  const estimatedProgress = meta.cursor / fileSizeEstimateBytes;

  try {
    await onBatch(results, { estimatedProgress, ...metaToParseMeta(meta) });
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
  forceFinish = false
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
    const estimatedCursor = Math.floor(papaChunk.meta.cursor - averageCursorPerRow * batchData.length * index);
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
        fileSizeEstimateBytes
      });
  });
  const queue = new PQueue({ concurrency: concurrentBatchMax, carryoverConcurrencyCount: true });
  await queue.addAll(promises);
  return papaChunk;
};
