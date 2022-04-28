// These options should be common for all formats.
// Some formats may ignore some options though.
export type ParseOptions = {
  types?: string[];
  columns?: string[];
  batchSize?: number;
  maxRows?: number;
  noheader?: boolean;
  callback: (lines: string[][], columns?: string[]) => Promise<boolean | void>;
};
