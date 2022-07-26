export class XataError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export * from './api';
export * from './plugins';
export * from './client';
export * from './schema';
export * from './search';
export * from './serializer';
export * from './util/config';
export * from './util/apiKey';
export * from './workers';
