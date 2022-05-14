import { FetcherExtraProps } from './api/fetcher';

export abstract class XataPlugin {
  abstract build(options: XataPluginOptions): unknown;
}

export type XataPluginOptions = {
  getFetchProps: () => Promise<FetcherExtraProps>;
};
