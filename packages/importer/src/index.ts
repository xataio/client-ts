// These options should be common for all formats.
// Some formats may ignore some options though.
export type ParseOptions = {
  types?: string[];
  columns?: string[];
  batchSize?: number;
  maxRows?: number;
  skipRows?: number;
  noheader?: boolean;
  delimiter?: string[];
  nullValue?: string[];
  ignoreColumnNormalization?: boolean;
  callback: (lines: string[][], columns: string[] | undefined, count: number) => Promise<boolean | void>;
};

export { parseFile as parseCSVFile, parseStream as parseCSVStream, parseString as parseCSVString } from './csv';
export { createProcessor } from './processor';
export type { CompareSchemaResult, TableInfo } from './processor';
export { generateRandomData } from './random-data';
