import { XataPlugin, XataPluginOptions } from '../plugins';
import { XataApiClient } from './client';
import { operationsByTag } from './components';
import type * as Responses from './responses';
import type * as Schemas from './schemas';

export type { FetchImpl } from '../util/fetch';
export * from './client';
export * from './components';
export { FetcherError } from './errors';
export type { FetcherExtraProps } from './fetcher';
export * from './providers';
export { operationsByTag as Operations };
export type { Responses, Schemas };

export class XataApiPlugin implements XataPlugin {
  build(options: XataPluginOptions) {
    return new XataApiClient(options);
  }
}
