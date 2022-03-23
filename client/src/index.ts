import { buildSortFilter } from './schema/filters';
import { Page } from './schema/pagination';
import { Query, QueryOptions } from './schema/query';
import { Selectable, SelectableColumn, Select } from './schema/selection';
import { errors } from './util/errors';

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
  select<K extends SelectableColumn<T>>(columns: K[]) {
    return new Query<T, Select<T, K>>(this.repository, this.table, { columns });
  }

  abstract create(object: Selectable<T>): Promise<T>;

  abstract createMany(objects: Selectable<T>[]): Promise<T[]>;

  abstract read(id: string): Promise<T | null>;

  abstract update(id: string, object: Partial<T>): Promise<T>;

  abstract delete(id: string): void;

  // Used by the Query object internally
  abstract _runQuery<R extends XataRecord, Options extends QueryOptions<T>>(
    query: Query<T, R>,
    options: Options
  ): Promise<
    Page<T, typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R>
  >;
}

export class RestRepository<T extends XataRecord> extends Repository<T> {
  client: BaseClient<any>;
  fetch: any;

  constructor(client: BaseClient<any>, table: string) {
    super(null, table, {});
    this.client = client;

    const doWeHaveFetch = typeof fetch !== 'undefined';
    const isInjectedFetchProblematic = !this.client.options.fetch;

    if (doWeHaveFetch) {
      this.fetch = fetch;
    } else if (isInjectedFetchProblematic) {
      throw new Error(errors.falsyFetchImplementation);
    } else {
      this.fetch = this.client.options.fetch;
    }

    Object.defineProperty(this, 'client', { enumerable: false });
    Object.defineProperty(this, 'fetch', { enumerable: false });
    Object.defineProperty(this, 'hostname', { enumerable: false });
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T | undefined> {
    const { databaseURL, apiKey } = this.client.options;
    const branch = await this.client.getBranch();
    const fetchImpl = this.fetch;

    const resp: Response = await fetchImpl(`${databaseURL}:${branch}${path}`, {
      method,
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      try {
        const json = await resp.json();
        const message = json.message;
        if (typeof message === 'string') {
          throw new XataError(message, resp.status);
        }
      } catch (err) {
        if (err instanceof XataError) throw err;
        // Ignore errors for other reasons.
        // For example if the response's body cannot be parsed as JSON
      }
      throw new XataError(resp.statusText, resp.status);
    }

    if (resp.status === 204) return undefined;
    return resp.json();
  }

  select<K extends SelectableColumn<T>>(columns: K[]) {
    return new Query<T, Select<T, K>>(this.repository, this.table, { columns });
  }

  async create(object: T): Promise<T> {
    const record = transformObjectLinks(object);

    const response = await this.request<{
      id: string;
      xata: { version: number };
    }>('POST', `/tables/${this.table}/data`, record);
    if (!response) {
      throw new Error("The server didn't return any data for the query");
    }

    const finalObject = await this.read(response.id);
    if (!finalObject) {
      throw new Error('The server failed to save the record');
    }

    return finalObject;
  }

  async createMany(objects: T[]): Promise<T[]> {
    const records = objects.map((object) => transformObjectLinks(object));

    const response = await this.request<{
      recordIDs: string[];
    }>('POST', `/tables/${this.table}/bulk`, { records });
    if (!response) {
      throw new Error("The server didn't return any data for the query");
    }

    // TODO: Use filer.$any() to get all the records
    const finalObjects = await Promise.all(response.recordIDs.map((id) => this.read(id)));
    if (finalObjects.some((object) => !object)) {
      throw new Error('The server failed to save the record');
    }

    return finalObjects as T[];
  }

  async read(id: string): Promise<T | null> {
    try {
      const response = await this.request<
        T & { id: string; xata: { version: number; table?: string; warnings?: string[] } }
      >('GET', `/tables/${this.table}/data/${id}`);
      if (!response) return null;

      return this.client.initObject(this.table, response);
    } catch (err) {
      if ((err as XataError).status === 404) return null;
      throw err;
    }
  }

  async update(id: string, object: Partial<T>): Promise<T> {
    const response = await this.request<{
      id: string;
      xata: { version: number };
    }>('PUT', `/tables/${this.table}/data/${id}`, object);
    if (!response) {
      throw new Error("The server didn't return any data for the query");
    }

    // TODO: Review this, not sure we are properly initializing the object
    return this.client.initObject(this.table, response);
  }

  async delete(id: string) {
    await this.request('DELETE', `/tables/${this.table}/data/${id}`);
  }

  async _runQuery<R extends XataRecord, Options extends QueryOptions<T>>(
    query: Query<T, R>,
    options: Options
  ): Promise<
    Page<T, typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R>
  > {
    const filter = {
      $any: query.$any,
      $all: query.$all,
      $not: query.$not,
      $none: query.$none
    };

    const body = {
      filter: Object.values(filter).some(Boolean) ? filter : undefined,
      sort: buildSortFilter(options?.sort) ?? query.$sort,
      page: options?.page,
      columns: options?.columns ?? query.columns
    };

    const response = await this.request<{
      records: object[];
      meta: { page: { cursor: string; more: boolean } };
    }>('POST', `/tables/${this.table}/query`, body);
    if (!response) {
      throw new Error("The server didn't return any data for the query");
    }

    const { meta, records: objects } = response;
    const records = objects.map((record) =>
      this.client.initObject<
        typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R
      >(this.table, record)
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
  fetch?: unknown;
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

export * from './schema/operators';
