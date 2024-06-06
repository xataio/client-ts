import { EditableData, Identifiable, SQLPlugin, XataPlugin, XataPluginOptions, XataRecord } from '@xata.io/client';
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

type ExcludeFromUnionIfNotOnlyType<Union, Type> = Exclude<Union, Type> extends never ? Union : Exclude<Union, Type>;

type RemoveIdentifiable<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends any[] // if it's an array
    ? ExcludeFromUnionIfNotOnlyType<T[K][number], Identifiable>[]
    : ExcludeFromUnionIfNotOnlyType<T[K], Identifiable>;
};

export type Model<Schemas extends Record<string, XataRecord>> = {
  [Model in keyof Schemas]: RemoveIdentifiable<EditableData<Schemas[Model]>>;
};

export * from './driver';
