import { XataPlugin, XataPluginOptions } from '../plugins';
import { XataApiClient } from './client';
import { operationsByTag } from './components';
import type * as Responses from './responses';
import type * as Schemas from './schemas';

export * from './client';
export * from './components';
export type { FetcherExtraProps, FetchImpl } from './fetcher';
export { operationsByTag as Operations };
export type { Responses, Schemas };

export class XataApiPlugin implements XataPlugin {
  async build(options: XataPluginOptions) {
    const { fetchImpl, apiKey } = await options.getFetchProps();
    return new XataApiClient({ fetch: fetchImpl, apiKey });
  }
}
