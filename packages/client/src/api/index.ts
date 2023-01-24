import { XataPlugin, XataPluginOptions } from '../plugins';
import { XataApiClient } from './client';
import { operationsByTag } from './components';
import type * as Responses from './responses';
import type * as Schemas from './schemas';

export * from './client';
export * from './components';
export * from './providers';
export type { FetcherExtraProps } from './fetcher';
export type { FetchImpl } from '../util/fetch';
export { operationsByTag as Operations };
export type { Responses, Schemas };
export { FetcherError } from './errors';

export class XataApiPlugin implements XataPlugin {
  build(options: XataPluginOptions) {
    const { fetchImpl, apiKey } = options.getFetchProps();
    return new XataApiClient({ fetch: fetchImpl, apiKey });
  }
}
