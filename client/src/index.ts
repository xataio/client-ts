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

export type Queries<T> = {
  [key in keyof T as T[key] extends Query<infer A, infer B> ? key : never]: T[key];
};

export type OmitQueries<T> = {
  [key in keyof T as T[key] extends Query<infer A, infer B> ? never : key]: T[key];
};

export type OmitLinks<T> = {
  [key in keyof T as T[key] extends XataRecord ? never : key]: T[key];
};

export type OmitMethods<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [key in keyof T as T[key] extends Function ? never : key]: T[key];
};

export type Selectable<T> = Omit<OmitQueries<OmitMethods<T>>, 'id' | 'xata'>;

// TODO: Add inference for links
export type SelectableColumn<T> = keyof Selectable<T> | '*';

// TODO: Add inference for links
export type Select<T, K extends SelectableColumn<T>> = (K extends keyof T ? Pick<T, K> : T) & Queries<T> & XataRecord;

export type Include<T> = {
  [key in keyof T as T[key] extends XataRecord ? key : never]?: boolean | Array<keyof Selectable<T[key]>>;
};

type SortDirection = 'asc' | 'desc';

type Operator =
  | '$gt'
  | '$lt'
  | '$ge'
  | '$le'
  | '$exists'
  | '$notExists'
  | '$endsWith'
  | '$startsWith'
  | '$pattern'
  | '$is'
  | '$isNot'
  | '$contains'
  | '$includes'
  | '$includesSubstring'
  | '$includesPattern'
  | '$includesAll';

// TODO: restrict constraints depending on type?
// E.g. startsWith cannot be used with numbers
type Constraint<T> = { [key in Operator]?: T };

type DeepConstraint<T> = T extends Record<string, any>
  ? {
      [key in keyof T]?: T[key] | DeepConstraint<T[key]>;
    }
  : Constraint<T>;

type ComparableType = number | Date;

export const gt = <T extends ComparableType>(value: T): Constraint<T> => ({ $gt: value });
export const ge = <T extends ComparableType>(value: T): Constraint<T> => ({ $ge: value });
export const gte = <T extends ComparableType>(value: T): Constraint<T> => ({ $ge: value });
export const lt = <T extends ComparableType>(value: T): Constraint<T> => ({ $lt: value });
export const lte = <T extends ComparableType>(value: T): Constraint<T> => ({ $le: value });
export const le = <T extends ComparableType>(value: T): Constraint<T> => ({ $le: value });
export const exists = (column: string): Constraint<string> => ({ $exists: column });
export const notExists = (column: string): Constraint<string> => ({ $notExists: column });
export const startsWith = (value: string): Constraint<string> => ({ $startsWith: value });
export const endsWith = (value: string): Constraint<string> => ({ $endsWith: value });
export const pattern = (value: string): Constraint<string> => ({ $pattern: value });
export const is = <T>(value: T): Constraint<T> => ({ $is: value });
export const isNot = <T>(value: T): Constraint<T> => ({ $isNot: value });
export const contains = <T>(value: T): Constraint<T> => ({ $contains: value });

// TODO: these can only be applied to columns of type "multiple"
export const includes = (value: string): Constraint<string> => ({ $includes: value });
export const includesSubstring = (value: string): Constraint<string> => ({ $includesSubstring: value });
export const includesPattern = (value: string): Constraint<string> => ({ $includesPattern: value });
export const includesAll = (value: string): Constraint<string> => ({ $includesAll: value });

type FilterConstraints<T> = {
  [key in keyof T]?: T[key] extends Record<string, any> ? FilterConstraints<T[key]> : T[key] | DeepConstraint<T[key]>;
};

type CursorNavigationOptions = { first?: string } | { last?: string } | { after?: string; before?: string };
type OffsetNavigationOptions = { size?: number; offset?: number };
type PaginationOptions = CursorNavigationOptions & OffsetNavigationOptions;

type BulkQueryOptions<T> = {
  page?: PaginationOptions;
  columns?: Array<keyof Selectable<T>>;
  /** TODO: Not implemented yet
  filter?: FilterConstraints<T>;
  sort?:
    | {
        column: keyof T;
        direction?: SortDirection;
      }
    | keyof T;
**/
};

type QueryOrConstraint<T extends XataRecord, R extends XataRecord> = Query<T, R> | Constraint<T>;

type QueryMeta = { page: { cursor: string; more: boolean } };

interface BasePage<T extends XataRecord, R extends XataRecord> {
  query: Query<T, R>;
  meta: QueryMeta;
  records: R[];

  nextPage(size?: number, offset?: number): Promise<Page<T, R>>;
  previousPage(size?: number, offset?: number): Promise<Page<T, R>>;
  firstPage(size?: number, offset?: number): Promise<Page<T, R>>;
  lastPage(size?: number, offset?: number): Promise<Page<T, R>>;

  hasNextPage(): boolean;
}

class Page<T extends XataRecord, R extends XataRecord> implements BasePage<T, R> {
  readonly query: Query<T, R>;
  readonly meta: QueryMeta;
  readonly records: R[];

  constructor(query: Query<T, R>, meta: QueryMeta, records: R[] = []) {
    this.query = query;
    this.meta = meta;
    this.records = records;
  }

  async nextPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.query.getPaginated({ page: { size, offset, after: this.meta.page.cursor } });
  }

  async previousPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.query.getPaginated({ page: { size, offset, before: this.meta.page.cursor } });
  }

  async firstPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.query.getPaginated({ page: { size, offset, first: this.meta.page.cursor } });
  }

  async lastPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.query.getPaginated({ page: { size, offset, last: this.meta.page.cursor } });
  }

  // TODO: We need to add something on the backend if we want a hasPreviousPage
  hasNextPage(): boolean {
    return this.meta.page.more;
  }
}

export class Query<T extends XataRecord, R extends XataRecord = T> implements BasePage<T, R> {
  table: string;
  repository: Repository<T>;

  readonly $any?: QueryOrConstraint<T, R>[];
  readonly $all?: QueryOrConstraint<T, R>[];
  readonly $not?: QueryOrConstraint<T, R>[];
  readonly $none?: QueryOrConstraint<T, R>[];
  readonly $sort?: Record<string, SortDirection>;
  readonly columns: SelectableColumn<T>[] = ['*'];

  // Cursor pagination
  readonly query: Query<T, R> = this;
  readonly meta: QueryMeta = { page: { cursor: 'start', more: true } };
  readonly records: R[] = [];

  constructor(repository: Repository<T> | null, table: string, data: Partial<Query<T, R>>, parent?: Query<T, R>) {
    if (repository) {
      this.repository = repository;
    } else {
      this.repository = this as any;
    }
    this.table = table;

    // For some reason Object.assign(this, parent) didn't work in this case
    // so doing all this manually:
    this.$any = parent?.$any;
    this.$all = parent?.$all;
    this.$not = parent?.$not;
    this.$none = parent?.$none;
    this.$sort = parent?.$sort;

    Object.assign(this, data);
    // These bindings are used to support deconstructing
    // const { any, not, filter, sort } = xata.users.query()
    this.any = this.any.bind(this);
    this.all = this.all.bind(this);
    this.not = this.not.bind(this);
    this.filter = this.filter.bind(this);
    this.sort = this.sort.bind(this);
    this.none = this.none.bind(this);

    Object.defineProperty(this, 'table', { enumerable: false });
    Object.defineProperty(this, 'repository', { enumerable: false });
  }

  any(...queries: Query<T, R>[]): Query<T, R> {
    return new Query<T, R>(
      this.repository,
      this.table,
      {
        $any: (this.$any || []).concat(queries)
      },
      this
    );
  }

  all(...queries: Query<T, R>[]): Query<T, R> {
    return new Query<T, R>(
      this.repository,
      this.table,
      {
        $all: (this.$all || []).concat(queries)
      },
      this
    );
  }

  not(...queries: Query<T, R>[]): Query<T, R> {
    return new Query<T, R>(
      this.repository,
      this.table,
      {
        $not: (this.$not || []).concat(queries)
      },
      this
    );
  }

  none(...queries: Query<T, R>[]): Query<T, R> {
    return new Query<T, R>(
      this.repository,
      this.table,
      {
        $none: (this.$none || []).concat(queries)
      },
      this
    );
  }

  filter(constraints: FilterConstraints<T>): Query<T, R>;
  filter<F extends keyof T>(column: F, value: FilterConstraints<T[F]> | DeepConstraint<T[F]>): Query<T, R>;
  filter(a: any, b?: any): Query<T, R> {
    if (arguments.length === 1) {
      const constraints = a as FilterConstraints<T>;
      const queries: QueryOrConstraint<T, R>[] = [];
      for (const [column, constraint] of Object.entries(constraints)) {
        queries.push({ [column]: constraint });
      }
      return new Query<T, R>(
        this.repository,
        this.table,
        {
          $all: (this.$all || []).concat(queries)
        },
        this
      );
    } else {
      const column = a as keyof T;
      const value = b as Partial<T[keyof T]> | Constraint<T[keyof T]>;
      return new Query<T, R>(
        this.repository,
        this.table,
        {
          $all: (this.$all || []).concat({ [column]: value })
        },
        this
      );
    }
  }

  sort<F extends keyof T>(column: F, direction: SortDirection): Query<T, R> {
    const sort = { ...this.$sort, [column]: direction };
    const q = new Query<T, R>(
      this.repository,
      this.table,
      {
        $sort: sort
      },
      this
    );

    return q;
  }

  async getPaginated(options?: BulkQueryOptions<T>): Promise<Page<T, R>> {
    return this.repository._runQuery(this, options);
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<R> {
    for await (const [record] of this.getIterator(1)) {
      yield record;
    }
  }

  async *getIterator(chunk: number, options: Omit<BulkQueryOptions<T>, 'page'> = {}): AsyncGenerator<R[]> {
    let offset = 0;
    let end = false;

    while (!end) {
      const { records, meta } = await this.getPaginated({ ...options, page: { size: chunk, offset } });
      yield records;

      offset += chunk;
      end = !meta.page.more;
    }
  }

  async getMany(options?: BulkQueryOptions<T>): Promise<R[]> {
    const { records } = await this.getPaginated(options);
    return records;
  }

  async getOne(options: Omit<BulkQueryOptions<T>, 'page'> = {}): Promise<R | null> {
    const records = await this.getMany({ ...options, page: { size: 1 } });
    return records[0] || null;
  }

  async deleteAll(): Promise<number> {
    // TODO: Return number of affected rows
    return 0;
  }

  include(columns: Include<T>) {
    // TODO
    return this;
  }

  async nextPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.firstPage(size, offset);
  }

  async previousPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.firstPage(size, offset);
  }

  async firstPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.getPaginated({ page: { size, offset } });
  }

  async lastPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.getPaginated({ page: { size, offset, before: 'end' } });
  }

  hasNextPage(): boolean {
    return this.meta.page.more;
  }
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
  abstract _runQuery<R extends XataRecord>(query: Query<T, R>, options?: BulkQueryOptions<T>): Promise<Page<T, R>>;
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

    const resp: Response = await this.fetch(`${databaseURL}:${branch}${path}`, {
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

  async _runQuery<R extends XataRecord>(query: Query<T, R>, options?: BulkQueryOptions<T>): Promise<Page<T, R>> {
    const filter = {
      $any: query.$any,
      $all: query.$all,
      $not: query.$not,
      $none: query.$none
    };

    const body = {
      filter: Object.values(filter).some(Boolean) ? filter : undefined,
      sort: query.$sort,
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
    const records = objects.map((record) => this.client.initObject<R>(this.table, record));

    return new Page(query, meta, records);
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
