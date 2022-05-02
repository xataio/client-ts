import {
  bulkInsertTableRecords,
  deleteRecord,
  getRecord,
  insertRecord,
  insertRecordWithID,
  queryTable,
  updateRecordWithID,
  upsertRecordWithID
} from '../api';
import { FetcherExtraProps, FetchImpl } from '../api/fetcher';
import { buildSortFilter } from './filters';
import { Page } from './pagination';
import { Query } from './query';
import { BaseData, EditableData, isIdentifiable, XataRecord } from './record';
import { SelectedPick } from './selection';

export type Links = Record<string, Array<string[]>>;

/**
 * Common interface for performing operations on a table.
 */
export abstract class Repository<Data extends BaseData, Record extends XataRecord = Data & XataRecord> extends Query<
  Record,
  SelectedPick<Record, ['*']>
> {
  /*
   * Creates a record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createMany(objects: EditableData<Data>[]): Promise<SelectedPick<Record, ['*']>[]>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(id: string): Promise<SelectedPick<Record, ['*']> | null>;

  /**
   * Insert a single record with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract insert(id: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updatd.
   * @returns The full persisted record.
   */
  abstract update(id: string, object: Partial<EditableData<Data>>): Promise<SelectedPick<Record, ['*']>>;

  /**
   * Updates or inserts a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract updateOrInsert(id: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>>;

  /**
   * Deletes a record given its unique id.
   * @param id The unique id.
   * @throws If the record could not be found or there was an error while performing the deletion.
   */
  abstract delete(id: string): void;

  abstract query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>>;
}

export class RestRepository<Data extends BaseData, Record extends XataRecord = Data & XataRecord> extends Query<
  Record,
  SelectedPick<Record, ['*']>
> {
  #client: BaseClient<any>;
  #fetch: any;
  #table: string;

  constructor(client: BaseClient<any>, table: string) {
    super(null, table, {});
    this.#client = client;
    this.#table = table;

    // TODO: Remove when integrating with API client
    const globalFetch = typeof fetch !== 'undefined' ? fetch : undefined;
    const fetchImpl = this.#client.options.fetch ?? globalFetch;
    if (!fetchImpl) {
      /** @todo add a link after docs exist */
      throw new Error(
        `The \`fetch\` option passed to the Xata client is resolving to a falsy value and may not be correctly imported.`
      );
    }
    this.#fetch = fetchImpl;
  }

  async #getFetchProps(): Promise<FetcherExtraProps> {
    const branch = await this.#client.getBranch();

    return {
      fetchImpl: this.#fetch,
      apiKey: this.#client.options.apiKey,
      apiUrl: '',
      // Instead of using workspace and dbBranch, we inject a probably CNAME'd URL
      workspacesApiUrl: (path, params) => {
        const baseUrl = this.#client.options.databaseURL ?? '';
        const hasBranch = params.dbBranchName ?? params.branch;
        const newPath = path.replace(/^\/db\/[^/]+/, hasBranch ? `:${branch}` : '');
        return baseUrl + newPath;
      }
    };
  }

  async create(object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>> {
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

  async createMany(objects: EditableData<Data>[]): Promise<SelectedPick<Record, ['*']>[]> {
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

  async read(recordId: string): Promise<SelectedPick<Record, ['*']> | null> {
    const fetchProps = await this.#getFetchProps();

    const response = await getRecord({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      ...fetchProps
    });

    return this.#client.initObject(this.#table, response);
  }

  async update(recordId: string, object: Partial<EditableData<Data>>): Promise<SelectedPick<Record, ['*']>> {
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

  async insert(recordId: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>> {
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
      ...fetchProps
    });

    const finalObject = await this.read(response.id);
    if (!finalObject) {
      throw new Error('The server failed to save the record');
    }

    return finalObject;
  }

  async updateOrInsert(recordId: string, object: EditableData<Data>): Promise<SelectedPick<Record, ['*']>> {
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

  async delete(recordId: string): Promise<void> {
    const fetchProps = await this.#getFetchProps();

    await deleteRecord({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      ...fetchProps
    });
  }

  async query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>> {
    const data = query.getQueryOptions();

    const body = {
      filter: Object.values(data.filter ?? {}).some(Boolean) ? data.filter : undefined,
      sort: buildSortFilter(data.sort),
      page: data.page,
      columns: data.columns
    };

    const fetchProps = await this.#getFetchProps();
    const { meta, records: objects } = await queryTable({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
      body,
      ...fetchProps
    });

    const records = objects.map((record) => this.#client.initObject<Result>(this.#table, record));

    return new Page<Record, Result>(query, meta, records);
  }
}

interface RepositoryFactory {
  createRepository<Data extends BaseData>(client: BaseClient<any>, table: string): Repository<Data & XataRecord>;
}

export class RestRespositoryFactory implements RepositoryFactory {
  createRepository<Data extends BaseData>(client: BaseClient<any>, table: string): Repository<Data & XataRecord> {
    return new RestRepository<Data & XataRecord>(client, table);
  }
}

type BranchStrategyValue = string | undefined | null;
type BranchStrategyBuilder = () => BranchStrategyValue | Promise<BranchStrategyValue>;
type BranchStrategy = BranchStrategyValue | BranchStrategyBuilder;
type BranchStrategyOption = NonNullable<BranchStrategy | BranchStrategy[]>;

export type XataClientOptions = {
  /**
   * Fetch implementation. This option is only required if the runtime does not include a fetch implementation
   * available in the global scope. If you are running your code on Deno or Cloudflare workers for example,
   * you won't need to provide a specific fetch implementation. But for most versions of Node.js you'll need
   * to provide one. Such as cross-fetch, node-fetch or isomorphic-fetch.
   */
  fetch?: FetchImpl;
  databaseURL?: string;
  branch: BranchStrategyOption;
  /**
   * API key to be used. You can create one in your account settings at https://app.xata.io/settings.
   */
  apiKey: string;
  repositoryFactory?: RepositoryFactory;
};

export class BaseClient<D extends Record<string, Repository<any>> = Record<string, Repository<any>>> {
  #links: Links;
  #branch: BranchStrategyValue;

  options: XataClientOptions;
  public db!: D;

  constructor(options: XataClientOptions, links: Links = {}) {
    if (!options.databaseURL || !options.apiKey || !options.branch) {
      throw new Error('Options databaseURL, apiKey and branch are required');
    }

    this.options = options;
    this.#links = links;

    const factory = options.repositoryFactory || new RestRespositoryFactory();

    this.db = new Proxy({} as D, {
      get: (_target, prop) => {
        if (typeof prop !== 'string') throw new Error('Invalid table name');
        return factory.createRepository(this, prop);
      }
    });
  }

  public initObject<T>(table: string, object: object) {
    const o: Record<string, unknown> = {};
    Object.assign(o, object);

    const tableLinks = this.#links[table] || [];
    for (const link of tableLinks) {
      const [field, linkTable] = link;
      const value = o[field];

      if (value && typeof value === 'object') {
        const { id } = value as any;
        if (Object.keys(value).find((col) => col === 'id')) {
          o[field] = this.initObject(linkTable, value);
        } else if (id) {
          o[field] = {
            id,
            get: () => {
              return this.db[linkTable].read(id);
            }
          };
        }
      }
    }

    const db = this.db;
    o.read = function () {
      return db[table].read(o['id'] as string);
    };
    o.update = function (data: any) {
      return db[table].update(o['id'] as string, data);
    };
    o.delete = function () {
      return db[table].delete(o['id'] as string);
    };

    for (const prop of ['read', 'update', 'delete']) {
      Object.defineProperty(o, prop, { enumerable: false });
    }

    Object.freeze(o);
    return o as T;
  }

  public async getBranch(): Promise<string> {
    if (this.#branch) return this.#branch;

    const { branch: param } = this.options;
    const strategies = Array.isArray(param) ? [...param] : [param];

    const evaluateBranch = async (strategy: BranchStrategy) => {
      return isBranchStrategyBuilder(strategy) ? await strategy() : strategy;
    };

    for await (const strategy of strategies) {
      const branch = await evaluateBranch(strategy);
      if (branch) {
        this.#branch = branch;
        return branch;
      }
    }

    throw new Error('Unable to resolve branch value');
  }
}

const isBranchStrategyBuilder = (strategy: BranchStrategy): strategy is BranchStrategyBuilder => {
  return typeof strategy === 'function';
};

const transformObjectLinks = (object: any) => {
  return Object.entries(object).reduce((acc, [key, value]) => {
    return { ...acc, [key]: isIdentifiable(value) ? value.id : value };
  }, {});
};
