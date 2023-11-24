export class XataError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export * from './api';
export * from './client';
export * from './plugins';
export * from './schema';
export * from './search';
export * from './sql';
export * from './serializer';
export * from './files';
export * from './transaction';
export { transformImage } from './files/transformations';
export type { ImageTransformations } from './files/transformations';
export { getAPIKey, getBranch, getDatabaseURL, getPreviewBranch, buildPreviewBranchName } from './util/environment';
