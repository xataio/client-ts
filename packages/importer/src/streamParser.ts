import { CsvStreamParserOptions, ParseCsvStreamOptions, ParseResults, ParseStreamResponse } from './types';
import Papa, { LocalFile, Parser, ParseResult } from 'papaparse';
import { papaResultToJson, parseCsvOptionsToPapaOptions } from './parser';
import { ReReadable } from 'rereadable-stream';

const parsePreview = async (
  fileStream: LocalFile,
  parserOptions: CsvStreamParserOptions,
  lines: number
): Promise<ParseResults> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      preview: lines,
      complete: (results) => resolve(papaResultToJson(results, parserOptions)),
      error: (error) => reject(error)
    });
  });
};

const parseRows = async ({ fileStream, parserOptions, chunkRowCount, onChunk }: Required<ParseCsvStreamOptions>) => {
  let chunk: Papa.ParseResult<unknown> | null = null;
  return new Promise((resolve, reject) => {
    Papa.parse(fileStream, {
      ...parseCsvOptionsToPapaOptions(parserOptions),
      chunk: (result: ParseResult<unknown>, parser: Parser) => {
        console.log('onChunk', result.data.length);
        if (!chunk) {
          chunk = result;
        } else {
          chunk.data = chunk.data.concat(result.data); // concat inefficient?
          chunk.meta = result.meta; // overwrite meta, probably ok?
          chunk.errors = chunk.errors.concat(result.errors); // concat inefficient?
        }
        parser.pause();
        chunk = processChunk(chunk, parser, parserOptions, chunkRowCount, onChunk);
        parser.resume();
      },
      complete: () => {
        if (chunk) {
          processChunk(chunk, null, parserOptions, chunkRowCount, onChunk, true);
        }
        resolve(null);
      },
      error: (error) => reject(error)
    });
  });
};

export const parseCsvFileStream = async ({
  fileStream,
  parserOptions,
  chunkRowCount = 1000,
  onChunk = () => null
}: ParseCsvStreamOptions): Promise<ParseStreamResponse> => {
  const clonedFileStream = fileStream.pipe(new ReReadable({ length: 10000000 }));

  const parsePreviewResult = await parsePreview(fileStream, parserOptions, parserOptions.previewLimit ?? 3);
  if (!parsePreviewResult.success) {
    throw new Error(`Failed to parse previewLimit rows. Errors:\n\n${parsePreviewResult.errors.join(', ')}`);
  }
  const { columns } = parsePreviewResult;
  console.log('columns', columns);
  await parseRows({ fileStream: clonedFileStream.rewind(), parserOptions, chunkRowCount, onChunk });
  return { columns };
};

const processChunk = (
  chunk: Papa.ParseResult<unknown>,
  parser: Papa.Parser | null,
  parserOptions: CsvStreamParserOptions,
  chunkRowCount: number,
  onChunk: (parseResults: ParseResults) => void,
  forceFinish = false
): Papa.ParseResult<unknown> => {
  if (chunk.data.length === 0 || (!forceFinish && chunk.data.length < chunkRowCount)) {
    return chunk;
  }
  const data = chunk.data.splice(0, chunkRowCount);
  const errors = chunk.errors.splice(0, chunkRowCount);
  const results = papaResultToJson({ data, errors, meta: chunk.meta }, parserOptions);
  try {
    onChunk(results);
  } catch (error) {
    // the user can throw an error to abort processing the file
    parser?.abort();
    throw error;
  }

  return processChunk(chunk, parser, parserOptions, chunkRowCount, onChunk);
};
