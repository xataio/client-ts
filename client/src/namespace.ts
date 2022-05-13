import { FetcherExtraProps, FetchImpl } from './api/fetcher';

export abstract class Namespace {
  abstract build(options: NamespaceBuildOptions): unknown;
}

export type NamespaceBuildOptions = {
  getFetchProps: () => Promise<FetcherExtraProps>;
};
