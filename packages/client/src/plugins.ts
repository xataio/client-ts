import { ApiExtraProps, HostProvider, Schemas } from './api';

export abstract class XataPlugin {
  abstract build(options: XataPluginOptions): unknown;
}

export type XataPluginOptions = ApiExtraProps & {
  host: HostProvider;
  tables: Schemas.Table[];
};
