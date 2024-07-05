import { SQLPlugin, XataPlugin, XataPluginOptions, XataRecord } from '@xata.io/client';
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

type XataFilePgFields = {
  id?: string;
  mediaType?: string;
  size?: number;
  name?: string;
  enablePublicUrl?: boolean;
  signedUrlTimeout?: number;
  storageKey?: string;
  uploadKey?: string;
  uploadUrlTimeout?: number;
  version?: number;
};

type RowTypeFields<T> = T extends { mediaType?: string }
  ? XataFilePgFields
  : T extends Array<{ mediaType?: string }>
  ? XataFilePgFields[]
  : T;

type RowType<O> = {
  [K in keyof O]: RowTypeFields<NonNullable<O[K]>>;
};

export type Model<Schemas extends Record<string, any>> = {
  [Model in keyof Schemas]: RowType<Schemas[Model]>;
};

export * from './driver';
