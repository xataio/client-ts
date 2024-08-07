import { ApiExtraProps, HostProvider } from './api';
import { DatabaseSchema } from './schema';

export abstract class XataPlugin {
  abstract build(options: XataPluginOptions): unknown;
}

export type XataPluginOptions = ApiExtraProps & {
  host: HostProvider;
  schema: DatabaseSchema;
  branch: string;
};
