// These options should be common for all formats.
// Some formats may ignore some options though.
export type ParseOptions = {
  types?: string[];
  columns?: string[];
  batchSize?: number;
  maxRows?: number;
  noheader?: boolean;
  callback: (lines: string[][], columns: string[] | undefined, count: number) => Promise<boolean | void>;
};

export { parseFile as parseCSVFile, parseStream as parseCSVStream } from './csv';
export { createProcessor } from './processor';
export type { CompareSchemaResult, TableInfo } from './processor';
