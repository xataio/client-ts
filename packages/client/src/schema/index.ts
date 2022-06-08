import { XataRecord } from '../api/schemas';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { isString } from '../util/lang';
import { BaseData } from './record';
import { Repository, RestRepository } from './repository';

export * from './cache';
export * from './operators';
export * from './pagination';
export { Query } from './query';
export { isIdentifiable, isXataRecord } from './record';
export type { BaseData, EditableData, Identifiable, XataRecord } from './record';
export { Repository, RestRepository } from './repository';
export * from './selection';

export type SchemaDefinition = {
  table: string;
};

export type SchemaPluginResult<Schemas extends Record<string, BaseData>> = {
  [Key in keyof Schemas]: Repository<Schemas[Key]>;
} & { [key: string]: Repository<XataRecord> };

export class SchemaPlugin<Schemas extends Record<string, BaseData>> extends XataPlugin {
  #tables: Record<string, Repository<any>> = {};

  constructor(private tableNames?: string[]) {
    super();
  }

  build(pluginOptions: XataPluginOptions): SchemaPluginResult<Schemas> {
    const db: any = new Proxy(
      {},
      {
        get: (_target, table) => {
          if (!isString(table)) throw new Error('Invalid table name');
          if (!this.#tables[table]) {
            this.#tables[table] = new RestRepository({ db, pluginOptions, table });
          }

          return this.#tables[table];
        }
      }
    );

    // Inject generated tables for shell to auto-complete
    for (const table of this.tableNames ?? []) {
      db[table] = new RestRepository({ db, pluginOptions, table });
    }

    return db;
  }
}
