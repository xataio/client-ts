import {
  insertRecordWithID,
  insertRecord,
  bulkInsertTableRecords,
  getRecord,
  updateRecordWithID,
  upsertRecordWithID,
  deleteRecord,
  queryTable
} from '../api';
import { FetcherExtraProps, FetchImpl } from '../api/fetcher';
import { buildSortFilter } from './filters';
import { Page } from './pagination';
import { Query, QueryOptions } from './query';
import { XataRecord } from './record';
import { Selectable, SelectableColumn, Select } from './selection';

export type Links = Record<string, Array<string[]>>;

/**
 * Common interface for performing operations on a table.
 */
export abstract class Repository<T extends XataRecord> extends Query<T> {
  /**
   * Creates a record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(object: Selectable<T>): Promise<T>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createMany(objects: Selectable<T>[]): Promise<T[]>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(id: string): Promise<T | null>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updatd.
   * @returns The full persisted record.
   */
  abstract update(id: string, object: Partial<Selectable<T>>): Promise<T>;

  /**
   * Updates or creates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract upsert(id: string, object: Selectable<T>): Promise<T>;

  /**
   * Deletes a record given its unique id.
   * @param id The unique id.
   * @throws If the record could not be found or there was an error while performing the deletion.
   */
  abstract delete(id: string): void;

  abstract query<R extends XataRecord, Options extends QueryOptions<T>>(
    query: Query<T, R>,
    options: Options
  ): Promise<
    Page<T, typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R>
  >;
}

export class RestRepository<T extends XataRecord> extends Repository<T> {
  #client: BaseClient<any>;
  #fetch: any;
  #table: string;

  constructor(client: BaseClient<any>, table: string) {
    super(null, table, {});
    this.#client = client;
    this.#table = table;

    // TODO: Remove when integrating with API client
    const fetchImpl = typeof fetch !== 'undefined' ? fetch : this.#client.options.fetch;
    if (!fetchImpl) {
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

  async create(object: Selectable<T>): Promise<T> {
    const fetchProps = await this.#getFetchProps();

    const record = transformObjectLinks(object);

    const response = object.id
      ? await insertRecordWithID({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            tableName: this.#table,
            recordId: object.id
          },
          body: record,
          ...fetchProps
        })
      : await insertRecord({
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

  async createMany(objects: T[]): Promise<T[]> {
    const fetchProps = await this.#getFetchProps();

    const records = objects.map((object) => transformObjectLinks(object));

    const response = await bulkInsertTableRecords({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
      body: { records },
      ...fetchProps
    });

    // TODO: Use filer.$any() to get all the records
    const finalObjects = await Promise.all(response.recordIDs.map((id) => this.read(id)));
    if (finalObjects.some((object) => !object)) {
      throw new Error('The server failed to save the record');
    }

    return finalObjects as T[];
  }

  async read(recordId: string): Promise<T | null> {
    const fetchProps = await this.#getFetchProps();

    const response = await getRecord({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      ...fetchProps
    });

    return this.#client.initObject(this.#table, response);
  }

  async update(recordId: string, object: Partial<Selectable<T>>): Promise<T> {
    const fetchProps = await this.#getFetchProps();

    const response = await updateRecordWithID({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      body: object,
      ...fetchProps
    });

    const item = await this.read(response.id);
    if (!item) throw new Error('The server failed to save the record');

    return item;
  }

  async upsert(recordId: string, object: Selectable<T>): Promise<T> {
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

  async delete(recordId: string) {
    const fetchProps = await this.#getFetchProps();

    await deleteRecord({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      ...fetchProps
    });
  }

  async query<R extends XataRecord, Options extends QueryOptions<T>>(
    query: Query<T, R>,
    options: Options
  ): Promise<
    Page<T, typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R>
  > {
    const data = query.getQueryOptions();

    const body = {
      filter: Object.values(data.filter).some(Boolean) ? data.filter : undefined,
      sort: buildSortFilter(options?.sort) ?? data.sort,
      page: options?.page ?? data.page,
      columns: options?.columns ?? data.columns
    };

    const fetchProps = await this.#getFetchProps();
    const { meta, records: objects } = await queryTable({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
      body,
      ...fetchProps
    });

    const records = objects.map((record) =>
      this.#client.initObject<
        typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R
      >(this.#table, record)
    );

    // TODO: We should properly type this any
    return new Page<T, any>(query, meta, records);
  }
}

interface RepositoryFactory {
  createRepository<T extends XataRecord>(client: BaseClient<any>, table: string): Repository<T>;
}

export class RestRespositoryFactory implements RepositoryFactory {
  createRepository<T extends XataRecord>(client: BaseClient<any>, table: string): Repository<T> {
    return new RestRepository<T>(client, table);
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

export class BaseClient<D extends Record<string, Repository<any>>> {
  #links: Links;
  #branch: BranchStrategyValue;

  options: XataClientOptions;
  db!: D;

  constructor(options: XataClientOptions, links: Links) {
    if (!options.databaseURL || !options.apiKey || !options.branch) {
      throw new Error('Options databaseURL, apiKey and branch are required');
    }

    this.options = options;
    this.#links = links;
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
              this.db[linkTable].read(id);
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

    // TODO: links and rev links

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

// TODO: We can find a better implementation for links
const transformObjectLinks = (object: any) => {
  return Object.entries(object).reduce((acc, [key, value]) => {
    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string') {
      return { ...acc, [key]: (value as XataRecord).id };
    }

    return { ...acc, [key]: value };
  }, {});
};
