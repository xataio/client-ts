import { bulkInsertTableRecords, deleteRecord, getRecord, insertRecord, insertRecordWithID, queryTable } from './api';
import { FetcherExtraProps, FetchImpl } from './api/fetcher';
import { buildSortFilter } from './schema/filters';
import { Page } from './schema/pagination';
import { Query, QueryOptions } from './schema/query';
import { Selectable, SelectableColumn, Select } from './schema/selection';

export interface XataRecord {
  id: string;
  xata: {
    version: number;
  };
  read(): Promise<this>;
  update(data: Selectable<this>): Promise<this>;
  delete(): Promise<void>;
}

export abstract class Repository<T extends XataRecord> extends Query<T> {
  abstract create(object: Selectable<T>): Promise<T>;

  abstract createMany(objects: Selectable<T>[]): Promise<T[]>;

  abstract read(id: string): Promise<T | null>;

  abstract update(id: string, object: Partial<T>): Promise<T>;

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

  get #fetchProps(): FetcherExtraProps {
    return {
      fetchImpl: this.#fetch,
      apiKey: this.#client.options.apiKey,
      apiUrl: '',
      workspacesApiUrl: (path, params) => {
        const baseUrl = this.#client.options.databaseURL ?? '';
        const branch = params.dbBranchName ?? params.branch;
        const newPath = path.replace(/^\/db\/[^/]+/, branch ? `:${branch}` : '');
        return baseUrl + newPath;
      }
    };
  }

  async create(object: T): Promise<T> {
    const branch = await this.#client.getBranch();

    const record = transformObjectLinks(object);

    const response = await insertRecord({
      pathParams: { workspace: '', dbBranchName: branch, tableName: this.#table },
      body: record,
      ...this.#fetchProps
    });

    const finalObject = await this.read(response.id);
    if (!finalObject) {
      throw new Error('The server failed to save the record');
    }

    return finalObject;
  }

  async createMany(objects: T[]): Promise<T[]> {
    const branch = await this.#client.getBranch();

    const records = objects.map((object) => transformObjectLinks(object));

    const response = await bulkInsertTableRecords({
      pathParams: { workspace: '', dbBranchName: branch, tableName: this.#table },
      body: { records },
      ...this.#fetchProps
    });

    // TODO: Use filer.$any() to get all the records
    const finalObjects = await Promise.all(response.recordIDs.map((id) => this.read(id)));
    if (finalObjects.some((object) => !object)) {
      throw new Error('The server failed to save the record');
    }

    return finalObjects as T[];
  }

  async read(recordId: string): Promise<T | null> {
    const branch = await this.#client.getBranch();

    const response = await getRecord({
      pathParams: { workspace: '', dbBranchName: branch, tableName: this.#table, recordId },
      ...this.#fetchProps
    });

    return this.#client.initObject(this.#table, response);
  }

  async update(recordId: string, object: Partial<T>): Promise<T> {
    const branch = await this.#client.getBranch();

    const response = await insertRecordWithID({
      pathParams: { workspace: '', dbBranchName: branch, tableName: this.#table, recordId },
      body: object,
      ...this.#fetchProps
    });

    // TODO: Review this, not sure we are properly initializing the object
    return this.#client.initObject(this.#table, response);
  }

  async delete(recordId: string) {
    const branch = await this.#client.getBranch();

    await deleteRecord({
      pathParams: { workspace: '', dbBranchName: branch, tableName: this.#table, recordId },
      ...this.#fetchProps
    });
  }

  async query<R extends XataRecord, Options extends QueryOptions<T>>(
    query: Query<T, R>,
    options: Options
  ): Promise<
    Page<T, typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R>
  > {
    const data = query.getData();

    const body = {
      filter: Object.values(data.filter).some(Boolean) ? data.filter : undefined,
      sort: buildSortFilter(options?.sort) ?? data.sort,
      page: options?.page ?? data.page,
      columns: options?.columns ?? data.columns
    };

    const branch = await this.#client.getBranch();
    const { meta, records: objects } = await queryTable({
      pathParams: { workspace: '', dbBranchName: branch, tableName: this.#table },
      body,
      ...this.#fetchProps
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
  fetch?: FetchImpl;
  databaseURL?: string;
  branch: BranchStrategyOption;
  apiKey: string;
  repositoryFactory?: RepositoryFactory;
};

export class BaseClient<D extends Record<string, Repository<any>>> {
  options: XataClientOptions;
  private links: Links;
  private branch: BranchStrategyValue;
  db!: D;

  constructor(options: XataClientOptions, links: Links) {
    if (!options.databaseURL || !options.apiKey || !options.branch) {
      throw new Error('Options databaseURL, apiKey and branch are required');
    }

    this.options = options;
    this.links = links;
  }

  public initObject<T>(table: string, object: object) {
    const o: Record<string, unknown> = {};
    Object.assign(o, object);

    const tableLinks = this.links[table] || [];
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
    if (this.branch) return this.branch;

    const { branch: param } = this.options;
    const strategies = Array.isArray(param) ? [...param] : [param];

    const evaluateBranch = async (strategy: BranchStrategy) => {
      return isBranchStrategyBuilder(strategy) ? await strategy() : strategy;
    };

    for await (const strategy of strategies) {
      const branch = await evaluateBranch(strategy);
      if (branch) {
        this.branch = branch;
        return branch;
      }
    }

    throw new Error('Unable to resolve branch value');
  }
}

export class XataError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Links = Record<string, Array<string[]>>;

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

export * from './api';
export * from './schema';
