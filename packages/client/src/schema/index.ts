import { XataPlugin, XataPluginOptions } from '../plugins';
import { isString } from '../util/lang';
import { DatabaseSchema, SchemaInference } from './inference';
import { Repository, RestRepository } from './repository';

export * from './ask';
export { XataFile } from './files';
export type { XataArrayFile } from './files';
export * from './inference';
export * from './operators';
export * from './pagination';
export { Query } from './query';
export { RecordColumnTypes, isIdentifiable } from './record';
export type { BaseData, EditableData, Identifiable, JSONData, Link, XataRecord } from './record';
export { Repository, RestRepository } from './repository';
export * from './selection';

export type SchemaDefinition = {
  table: string;
};

export type SchemaPluginResult<Schema extends DatabaseSchema> = {
  [Key in Schema['tables'][number]['name']]: Repository<Schema, Key, SchemaInference<Schema['tables']>[Key]>;
};

export class SchemaPlugin<Schema extends DatabaseSchema> extends XataPlugin {
  #tables: Record<string, Repository<any, any, any>> = {};

  constructor() {
    super();
  }

  build(pluginOptions: XataPluginOptions): SchemaPluginResult<Schema> {
    const db: any = new Proxy(
      {},
      {
        get: (_target, table) => {
          if (!isString(table)) throw new Error('Invalid table name');
          if (this.#tables[table] === undefined) {
            this.#tables[table] = new RestRepository({ db, pluginOptions, table, schema: pluginOptions.schema });
          }

          return this.#tables[table];
        }
      }
    );

    // Inject generated tables for shell to auto-complete
    const tableNames = pluginOptions.schema.tables.map(({ name }) => name) ?? [];
    for (const table of tableNames) {
      db[table] = new RestRepository({ db, pluginOptions, table, schema: pluginOptions.schema });
    }

    return db;
  }
}
