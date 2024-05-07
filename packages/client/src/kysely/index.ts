import { Kysely } from 'kysely';
import { XataDialect } from './driver';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { XataRecord, EditableData } from '../schema';
import { SQLPlugin } from '../sql';

export type KyselyPluginResult<Schemas extends Record<string, XataRecord>> = Kysely<Model<Schemas>>;

export class KyselyPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  build(pluginOptions: XataPluginOptions): KyselyPluginResult<Schemas> {
    const xata = { sql: new SQLPlugin().build(pluginOptions) };

    return new Kysely<Model<Schemas>>({
      dialect: new XataDialect({ xata })
    });
  }
}

export type Model<Schemas extends Record<string, XataRecord>> = {
  [Model in keyof Schemas]: EditableData<Schemas[Model]>;
};

export * from './driver';
