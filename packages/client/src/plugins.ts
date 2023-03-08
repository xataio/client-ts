import { ApiExtraProps, HostProvider } from './api';
import { CacheImpl } from './schema/cache';

export abstract class XataPlugin {
  abstract build(options: XataPluginOptions): unknown;
}

export type XataPluginOptions = ApiExtraProps & {
  cache: CacheImpl;
  host: HostProvider;
};
