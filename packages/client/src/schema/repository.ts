import { SchemaPluginResult } from '.';
import {
  bulkInsertTableRecords,
  deleteRecord,
  getRecord,
  insertRecord,
  insertRecordWithID,
  queryTable,
  searchBranch,
  updateRecordWithID,
  upsertRecordWithID
} from '../api';
import { FetcherExtraProps } from '../api/fetcher';
import { RecordsMetadata } from '../api/schemas';
import { XataPluginOptions } from '../plugins';
import { isObject, isString } from '../util/lang';
import { Dictionary } from '../util/types';
import { CacheImpl } from './cache';
import { Page } from './pagination';
import { Query } from './query';
import { BaseData, EditableData, Identifiable, isIdentifiable, XataRecord } from './record';
import { SelectedPick } from './selection';
import { buildSortFilter } from './sorting';

type TableLink = string[];
export type LinkDictionary = Dictionary<TableLink[]>;

/**
 * Common interface for performing operations on a table.
 */
export abstract class Repository<Data extends BaseData, Record extends XataRecord = Data & XataRecord> extends Query<
  Record,
  Readonly<SelectedPick<Record, ['*']>>
> {
  /*
   * Creates a single record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(object: EditableData<Data> & Partial<Identifiable>): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates a single record in the table with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(id: string, object: EditableData<Data>): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract create(
    objects: Array<EditableData<Data> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(id: string): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @returns The full persisted record.
   */
  abstract update(object: Partial<EditableData<Data>> & Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @returns The full persisted record.
   */
  abstract update(id: string, object: Partial<EditableData<Data>>): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @returns Array of the persisted records.
   */
  abstract update(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(object: EditableData<Data> & Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(id: string, object: EditableData<Data>): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createOrUpdate(
    objects: Array<EditableData<Data> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Deletes a record given its unique id.
   * @param id The unique id.
   * @throws If the record could not be found or there was an error while performing the deletion.
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Deletes a record given its unique id.
   * @param id An object with a unique id.
   * @throws If the record could not be found or there was an error while performing the deletion.
   */
  abstract delete(id: Identifiable): Promise<void>;

  /**
   * Deletes a record given a list of unique ids.
   * @param ids The array of unique ids.
   * @throws If the record could not be found or there was an error while performing the deletion.
   */
  abstract delete(ids: string[]): Promise<void>;

  /**
   * Deletes a record given a list of unique ids.
   * @param ids An array of objects with unique ids.
   * @throws If the record could not be found or there was an error while performing the deletion.
   */
  abstract delete(ids: Identifiable[]): Promise<void>;

  /**
   * Search for records in the table.
   * @param query The query to search for.
   * @param options The options to search with (like: fuzziness)
   * @returns The found records.
   */
  abstract search(query: string, options?: { fuzziness?: number }): Promise<SelectedPick<Record, ['*']>[]>;

  abstract query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>>;
}

export class RestRepository<Data extends BaseData, Record extends XataRecord = Data & XataRecord>
  extends Query<Record, SelectedPick<Record, ['*']>>
  implements Repository<Data, Record>
{
  #table: string;
  #links: LinkDictionary;
  #getFetchProps: () => Promise<FetcherExtraProps>;
  db: SchemaPluginResult<any>;
  recordCache: CacheImpl;
  queryCache: CacheImpl;

  constructor(options: {
    table: string;
    links?: LinkDictionary;
    db: SchemaPluginResult<any>;
    pluginOptions: XataPluginOptions;
  }) {
    super(null, options.table, {});

    this.#table = options.table;
    this.#links = options.links ?? {};
    this.#getFetchProps = options.pluginOptions.getFetchProps;
    this.db = options.db;
    this.recordCache = options.pluginOptions.cache;
    this.queryCache = options.pluginOptions.cache;
  }

  async create(object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>>;
  async create(recordId: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>>;
  async create(objects: EditableData<Data>[]): Promise<SelectedPick<Record, ['*']>[]>;
  async create(
    a: string | EditableData<Data> | EditableData<Data>[],
    b?: EditableData<Data>
  ): Promise<SelectedPick<Record, ['*']> | SelectedPick<Record, ['*']>[]> {
    // Create many records
    if (Array.isArray(a)) {
      const records = await this.#bulkInsertTableRecords(a);
      await Promise.all(records.map((record) => this.recordCache.set(`${this.#table}-${record.id}`, record)));

      return records;
    }

    // Create one record with id as param
    if (isString(a) && isObject(b)) {
      if (a === '') throw new Error("The id can't be empty");
      const record = await this.#insertRecordWithId(a, b);
      await this.recordCache.set(`${this.#table}-${record.id}`, record);

      return record;
    }

    // Create one record with id as property
    if (isObject(a) && isString(a.id)) {
      if (a.id === '') throw new Error("The id can't be empty");
      const record = await this.#insertRecordWithId(a.id, { ...a, id: undefined });
      await this.recordCache.set(`${this.#table}-${record.id}`, record);

      return record;
    }

    // Create one record without id
    if (isObject(a)) {
      const record = await this.#insertRecordWithoutId(a);
      await this.recordCache.set(`${this.#table}-${record.id}`, record);

      return record;
    }

    throw new Error('Invalid arguments for create method');
  }

  async #insertRecordWithoutId(object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>> {
    const fetchProps = await this.#getFetchProps();

    const record = transformObjectLinks(object);

    const response = await insertRecord({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        tableName: this.#table
      },
      body: record,
      ...fetchProps
    });

    const finalObject = await this.read(response.id);
    if (!finalObject) {
      throw new Error('The server failed to save the record');
    }

    return finalObject;
  }

  async #insertRecordWithId(recordId: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>> {
    const fetchProps = await this.#getFetchProps();

    const record = transformObjectLinks(object);

    const response = await insertRecordWithID({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        tableName: this.#table,
        recordId
      },
      body: record,
      queryParams: { createOnly: true },
      ...fetchProps
    });

    const finalObject = await this.read(response.id);
    if (!finalObject) {
      throw new Error('The server failed to save the record');
    }

    return finalObject;
  }

  async #bulkInsertTableRecords(objects: EditableData<Data>[]): Promise<SelectedPick<Record, ['*']>[]> {
    const fetchProps = await this.#getFetchProps();

    const records = objects.map((object) => transformObjectLinks(object));

    const response = await bulkInsertTableRecords({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
      body: { records },
      ...fetchProps
    });

    const finalObjects = await this.any(...response.recordIDs.map((id) => this.filter('id', id))).getAll();
    if (finalObjects.length !== objects.length) {
      throw new Error('The server failed to save some records');
    }

    return finalObjects;
  }

  // TODO: Add column support: https://github.com/xataio/openapi/issues/139
  async read(recordId: string): Promise<SelectedPick<Record, ['*']> | null> {
    const cacheRecord = await this.recordCache.get<SelectedPick<Record, ['*']>>(`${this.#table}-${recordId}`);
    if (cacheRecord) return cacheRecord;

    const fetchProps = await this.#getFetchProps();

    try {
      const response = await getRecord({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
        ...fetchProps
      });

      return initObject(this.db, this.#links, this.#table, response);
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async update(object: Partial<EditableData<Data>> & Identifiable): Promise<SelectedPick<Record, ['*']>>;
  async update(recordId: string, object: Partial<EditableData<Data>>): Promise<SelectedPick<Record, ['*']>>;
  async update(objects: Array<Partial<EditableData<Data>> & Identifiable>): Promise<SelectedPick<Record, ['*']>[]>;
  async update(
    a: string | (Partial<EditableData<Data>> & Identifiable) | Array<Partial<EditableData<Data>> & Identifiable>,
    b?: Partial<EditableData<Data>>
  ): Promise<SelectedPick<Record, ['*']> | SelectedPick<Record, ['*']>[]> {
    // Update many records
    if (Array.isArray(a)) {
      if (a.length > 100) {
        // TODO: Implement bulk update when API has support for it
        console.warn('Bulk update operation is not optimized in the Xata API yet, this request might be slow');
      }
      return Promise.all(a.map((object) => this.update(object)));
    }

    // Update one record with id as param
    if (isString(a) && isObject(b)) {
      await this.recordCache.delete(`${this.#table}-${a}`);
      const record = await this.#updateRecordWithID(a, b);
      await this.recordCache.set(`${this.#table}-${record.id}`, record);

      return record;
    }

    // Update one record with id as property
    if (isObject(a) && isString(a.id)) {
      await this.recordCache.delete(`${this.#table}-${a.id}`);
      const record = await this.#updateRecordWithID(a.id, { ...a, id: undefined });
      await this.recordCache.set(`${this.#table}-${record.id}`, record);

      return record;
    }

    throw new Error('Invalid arguments for update method');
  }

  async #updateRecordWithID(
    recordId: string,
    object: Partial<EditableData<Data>>
  ): Promise<SelectedPick<Record, ['*']>> {
    const fetchProps = await this.#getFetchProps();

    const record = transformObjectLinks(object);

    const response = await updateRecordWithID({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      body: record,
      ...fetchProps
    });

    const item = await this.read(response.id);
    if (!item) throw new Error('The server failed to save the record');

    return item;
  }

  async createOrUpdate(object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>>;
  async createOrUpdate(recordId: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>>;
  async createOrUpdate(objects: EditableData<Data>[]): Promise<SelectedPick<Record, ['*']>[]>;
  async createOrUpdate(
    a: string | EditableData<Data> | EditableData<Data>[],
    b?: EditableData<Data>
  ): Promise<SelectedPick<Record, ['*']> | SelectedPick<Record, ['*']>[]> {
    // Create or update many records
    if (Array.isArray(a)) {
      if (a.length > 100) {
        // TODO: Implement bulk update when API has support for it
        console.warn('Bulk update operation is not optimized in the Xata API yet, this request might be slow');
      }

      return Promise.all(a.map((object) => this.createOrUpdate(object)));
    }

    // Create or update one record with id as param
    if (isString(a) && isObject(b)) {
      await this.recordCache.delete(`${this.#table}-${a}`);
      const record = await this.#upsertRecordWithID(a, b);
      await this.recordCache.set(`${this.#table}-${record.id}`, record);

      return record;
    }

    // Create or update one record with id as property
    if (isObject(a) && isString(a.id)) {
      await this.recordCache.delete(`${this.#table}-${a.id}`);
      const record = await this.#upsertRecordWithID(a.id, { ...a, id: undefined });
      await this.recordCache.set(`${this.#table}-${record.id}`, record);

      return record;
    }

    throw new Error('Invalid arguments for createOrUpdate method');
  }

  async #upsertRecordWithID(recordId: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>> {
    const fetchProps = await this.#getFetchProps();

    const response = await upsertRecordWithID({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      body: object,
      ...fetchProps
    });

    const item = await this.read(response.id);
    if (!item) throw new Error('The server failed to save the record');

    return item;
  }

  async delete(a: string | Identifiable | Array<string | Identifiable>): Promise<void> {
    // Delete many records
    if (Array.isArray(a)) {
      if (a.length > 100) {
        // TODO: Implement bulk delete when API has support for it
        console.warn('Bulk delete operation is not optimized in the Xata API yet, this request might be slow');
      }

      await Promise.all(a.map((id) => this.delete(id)));
      return;
    }

    // Delete one record with id as param
    if (isString(a)) {
      await this.#deleteRecord(a);
      await this.recordCache.delete(`${this.#table}-${a}`);
      return;
    }

    // Delete one record with id as property
    if (isObject(a) && isString(a.id)) {
      await this.#deleteRecord(a.id);
      await this.recordCache.delete(`${this.#table}-${a.id}`);
      return;
    }

    throw new Error('Invalid arguments for delete method');
  }

  async #deleteRecord(recordId: string): Promise<void> {
    const fetchProps = await this.#getFetchProps();

    await deleteRecord({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      ...fetchProps
    });
  }

  async search(query: string, options: { fuzziness?: number } = {}): Promise<SelectedPick<Record, ['*']>[]> {
    const fetchProps = await this.#getFetchProps();

    const { records } = await searchBranch({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}' },
      body: { tables: [this.#table], query, fuzziness: options.fuzziness },
      ...fetchProps
    });

    return records.map((item) => initObject(this.db, this.#links, this.#table, item));
  }

  async query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>> {
    const cacheQuery = await this.queryCache.get<{ meta: RecordsMetadata; records: Result[] }>(query.key());
    if (cacheQuery) return new Page<Record, Result>(query, cacheQuery.meta, cacheQuery.records);

    const data = query.getQueryOptions();

    const body = {
      filter: Object.values(data.filter ?? {}).some(Boolean) ? data.filter : undefined,
      sort: data.sort ? buildSortFilter(data.sort) : undefined,
      page: data.page,
      columns: data.columns
    };

    const fetchProps = await this.#getFetchProps();
    const { meta, records: objects } = await queryTable({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
      body,
      ...fetchProps
    });

    const records = objects.map((record) => initObject<Result>(this.db, this.#links, this.#table, record));
    await this.queryCache.set(query.key(), { meta, records });

    return new Page<Record, Result>(query, meta, records);
  }
}

const transformObjectLinks = (object: any) => {
  return Object.entries(object).reduce((acc, [key, value]) => {
    // Ignore internal properties
    if (key === 'xata') return acc;

    // Transform links to identifier
    return { ...acc, [key]: isIdentifiable(value) ? value.id : value };
  }, {});
};

export const initObject = <T>(
  db: Record<string, Repository<any>>,
  links: LinkDictionary,
  table: string,
  object: object
) => {
  const result: Dictionary<unknown> = {};
  Object.assign(result, object);

  const tableLinks = links[table] || [];
  for (const link of tableLinks) {
    const [field, linkTable] = link;
    const value = result[field];

    if (value && isObject(value)) {
      result[field] = initObject(db, links, linkTable, value);
    }
  }

  result.read = function () {
    return db[table].read(result['id'] as string);
  };
  result.update = function (data: any) {
    return db[table].update(result['id'] as string, data);
  };
  result.delete = function () {
    return db[table].delete(result['id'] as string);
  };

  for (const prop of ['read', 'update', 'delete']) {
    Object.defineProperty(result, prop, { enumerable: false });
  }

  Object.freeze(result);
  return result as T;
};
