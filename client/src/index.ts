import { XataApi } from './api';
import { FetchImpl } from './api/xatabaseFetcher';

export interface XataObject {
  id: string;
  xata: {
    version: number;
  };
  read(): Promise<this>;
  update(data: Selectable<this>): Promise<this>;
  delete(): Promise<void>;
}

type Queries<T> = {
  [key in keyof T as T[key] extends Query<infer A, infer B> ? key : never]: T[key];
};

type OmitQueries<T> = {
  [key in keyof T as T[key] extends Query<infer A, infer B> ? never : key]: T[key];
};

type OmitLinks<T> = {
  [key in keyof T as T[key] extends XataObject ? never : key]: T[key];
};

type OmitMethods<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [key in keyof T as T[key] extends Function ? never : key]: T[key];
};

type Selectable<T> = Omit<OmitQueries<OmitMethods<T>>, 'id' | 'xata'>;

type Select<T, K extends keyof T> = Pick<T, K> & Queries<T> & XataObject;

type Include<T> = {
  [key in keyof T as T[key] extends XataObject ? key : never]?: boolean | Array<keyof Selectable<T[key]>>;
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

type QueryOrConstraint<T, R> = Query<T, R> | Constraint<T>;

type QueryMeta = { page: { cursor: string; more: boolean } };

interface BasePage<T, R> {
  query: Query<T, R>;
  meta: QueryMeta;
  records: R[];

  nextPage(size?: number, offset?: number): Promise<Page<T, R>>;
  previousPage(size?: number, offset?: number): Promise<Page<T, R>>;
  firstPage(size?: number, offset?: number): Promise<Page<T, R>>;
  lastPage(size?: number, offset?: number): Promise<Page<T, R>>;

  hasNextPage(): boolean;
}

class Page<T, R> implements BasePage<T, R> {
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

export class Query<T, R = T> implements BasePage<T, R> {
  client: BaseClient<any>;
  table: string;
  repository: Repository<T>;

  readonly $any?: QueryOrConstraint<T, R>[];
  readonly $all?: QueryOrConstraint<T, R>[];
  readonly $not?: QueryOrConstraint<T, R>[];
  readonly $none?: QueryOrConstraint<T, R>[];
  readonly $sort?: Record<string, SortDirection>;

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
    this.client = this.repository.client;

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
    const filter = {
      $any: this.$any,
      $all: this.$all,
      $not: this.$not,
      $none: this.$none
    };

    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();
    const { meta, records: objects } = await this.client.api.records.queryTable(
      workspace,
      database,
      branch,
      this.table,
      {
        //@ts-ignore TODO: Review
        filter: compactObject(filter),
        sort: this.$sort,
        page: options?.page
      }
    );

    const records = objects.map((record) => this.client.initObject<R>(this.table, record));

    return new Page(this, meta, records);
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
export class Repository<T> extends Query<T, Selectable<T>> {
  client: BaseClient<any>;

  constructor(client: BaseClient<any>, table: string) {
    super(null, table, {});
    this.client = client;

    Object.defineProperty(this, 'client', { enumerable: false });
  }

  select<K extends keyof T>(...columns: K[]) {
    return new Query<T, Select<T, K>>(this.repository, this.table, {});
  }

  async create(object: T): Promise<T & XataObject> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const record = transformObjectLinks(object);

    const response = await this.client.api.records.insertRecord(workspace, database, branch, this.table, record);

    const finalObject = await this.read(response.id);
    if (!finalObject) {
      throw new Error('The server failed to save the record');
    }

    return finalObject;
  }

  async createMany(objects: T[]): Promise<(T & XataObject)[]> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const records = objects.map((object) => transformObjectLinks(object));

    const response = await this.client.api.records.bulkInsertTableRecords(
      workspace,
      database,
      branch,
      this.table,
      records
    );

    // TODO: Use filer.$any() to get all the records
    const finalObjects = await Promise.all(response.recordIDs.map((id) => this.read(id)));
    if (finalObjects.some((object) => !object)) {
      throw new Error('The server failed to save the record');
    }

    return finalObjects as (T & XataObject)[];
  }

  async read(id: string): Promise<(T & XataObject) | null> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const response = await this.client.api.records.getRecord(workspace, database, branch, this.table, id);

    return this.client.initObject(this.table, response);
  }

  async update(id: string, object: Partial<T>): Promise<T & XataObject> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const response = await this.client.api.records.insertRecordWithID(
      workspace,
      database,
      branch,
      this.table,
      id,
      object
    );

    // TODO: Review this, not sure we are properly initializing the object
    return this.client.initObject(this.table, response);
  }

  async delete(id: string) {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    await this.client.api.records.deleteRecord(workspace, database, branch, this.table, id);
  }
}

function compactObject<T>(object: T): Partial<T> {
  return Object.entries(object).reduce((acc, [key, value]) => {
    // @ts-ignore TODO: Review
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {} as Partial<T>);
}

interface RepositoryFactory {
  createRepository<T>(client: BaseClient<any>, table: string): Repository<T>;
}

export class RestRespositoryFactory implements RepositoryFactory {
  createRepository<T>(client: BaseClient<any>, table: string): Repository<T> {
    return new Repository<T>(client, table);
  }
}

type BranchStrategyValue = string | undefined | null;
type BranchStrategyBuilder = () => BranchStrategyValue | Promise<BranchStrategyValue>;
type BranchStrategy = BranchStrategyValue | BranchStrategyBuilder;
type BranchStrategyOption = NonNullable<BranchStrategy | BranchStrategy[]>;

export type XataClientOptions = {
  fetch?: FetchImpl;
  workspace?: string;
  database?: string;
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
    if (!options.workspace || !options.apiKey || !options.branch) {
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

  public async getWorkspaceId(): Promise<string> {
    if (!this.options.workspace) throw new Error('Workspace is not defined');
    return this.options.workspace;
  }

  public async getDatabaseId(): Promise<string> {
    if (!this.options.database) throw new Error('Database is not defined');
    return this.options.database;
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

  public get api() {
    return new XataApi<D>(this);
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
      return { ...acc, [key]: (value as XataObject).id };
    }

    return { ...acc, [key]: value };
  }, {});
};
