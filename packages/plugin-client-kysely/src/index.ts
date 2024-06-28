import {
  Identifiable,
  SQLPlugin,
  XataArrayFile,
  XataFile,
  XataPlugin,
  XataPluginOptions,
  XataRecord
} from '@xata.io/client';
import { Kysely } from 'kysely';
import { XataDialect } from './driver';

export type KyselyPluginResult<Schemas extends Record<string, XataRecord>> = Kysely<Model<Schemas>>;

export class KyselyPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  build(pluginOptions: XataPluginOptions): KyselyPluginResult<Schemas> {
    const xata = { sql: new SQLPlugin().build(pluginOptions) };

    return new Kysely<Model<Schemas>>({
      dialect: new XataDialect({ xata })
    });
  }
}

type StringKeys<O> = Extract<keyof O, string>;

type XataFileFields = Partial<
  Pick<
    XataArrayFile,
    { [K in StringKeys<XataArrayFile>]: XataArrayFile[K] extends Function ? never : K }[keyof XataArrayFile]
  >
>;

type RowTypeFields<T> = T extends XataFileFields ? XataFileFields : T;

type RowType<O> = {
  [K in keyof O]: RowTypeFields<O[K]>;
};

export type Model<Schemas extends Record<string, any>> = {
  [Model in keyof Schemas]: RowType<Schemas[Model]>;
};

export * from './driver';
