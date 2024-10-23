import { Kysely } from 'kysely';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { XataRecord } from '../schema';
import { SQLPlugin } from '../sql';
import { Model, XataDialect } from '@xata.io/kysely';

export type KyselyPluginResult<Schemas extends Record<string, XataRecord>> = Kysely<Model<Schemas>>;

export class KyselyPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  build(pluginOptions: XataPluginOptions): KyselyPluginResult<Schemas> {
    const xata = { sql: new SQLPlugin().build(pluginOptions) };

    return new Kysely<Model<Schemas>>({
      dialect: new XataDialect({ xata })
    });
  }
}
