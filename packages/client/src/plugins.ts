import { FetcherExtraProps } from './api/fetcher';
import { CacheImpl } from './schema/cache';
import { TraceFunction } from './schema/tracing';

export abstract class XataPlugin {
  abstract build(options: XataPluginOptions): unknown | Promise<unknown>;
}

export type XataPluginOptions = {
  getFetchProps: () => Promise<FetcherExtraProps>;
  cache: CacheImpl;
  trace?: TraceFunction;
};
