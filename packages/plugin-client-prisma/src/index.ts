import { SQLPlugin, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { PrismaXataHTTP } from './driver';

export class PrismaPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions) {
    const xata = { sql: new SQLPlugin().build(pluginOptions) };

    return new PrismaXataHTTP(xata, pluginOptions.tables);
  }
}

export * from './driver';
