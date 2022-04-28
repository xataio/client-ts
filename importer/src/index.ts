// These options should be common for all formats.
// Some formats may ignore some options though.
export type ParseOptions = {
  columns?: string[];
  batchSize?: number;
  noheader?: boolean;
  callback: (lines: unknown[], columns?: string[]) => Promise<void>;
};
