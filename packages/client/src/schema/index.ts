import { XataPlugin, XataPluginOptions } from '../plugins';
import { isString } from '../util/lang';
import { XataRecord } from './record';
import { Repository, RestRepository } from './repository';

export * from './ask';
export { XataFile } from './files';
export type { XataArrayFile } from './files';
export * from './inference';
export * from './operators';
export * from './pagination';
export { Query } from './query';
export { RecordColumnTypes, isIdentifiable, isXataRecord } from './record';
export type { BaseData, EditableData, Identifiable, JSONData, Link, XataRecord } from './record';
export { Repository, RestRepository } from './repository';
export * from './selection';

export type SchemaDefinition = {
  table: string;
};

export type SchemaPluginResult<Schemas extends Record<string, XataRecord>> = {
  [Key in keyof Schemas]: Repository<Schemas[Key]>;
};

export class SchemaPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  #tables: Record<string, Repository<any>> = {};

  constructor() {
    super();
  }

  build(pluginOptions: XataPluginOptions): SchemaPluginResult<Schemas> {
    const db: any = new Proxy(
      {},
      {
        get: (_target, table) => {
          if (!isString(table)) throw new Error('Invalid table name');
          if (this.#tables[table] === undefined) {
            this.#tables[table] = new RestRepository({ db, pluginOptions, table, schemaTables: pluginOptions.tables });
          }

          return this.#tables[table];
        }
      }
    );

    // Inject generated tables for shell to auto-complete
    const tableNames = pluginOptions.tables?.map(({ name }) => name) ?? [];
    for (const table of tableNames) {
      db[table] = new RestRepository({ db, pluginOptions, table, schemaTables: pluginOptions.tables });
    }

    return db;
  }
}
