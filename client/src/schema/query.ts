import { BaseClient } from '..';
import { Schema } from '.';
import { XataObject } from './xataObject';

export class Query<T, R = T> implements BasePage<T, R> {
  client: BaseClient<any>;
  table: string;
  repository: Schema<T>;

  readonly $any?: QueryOrConstraint<T, R>[];
  readonly $all?: QueryOrConstraint<T, R>[];
  readonly $not?: QueryOrConstraint<T, R>[];
  readonly $none?: QueryOrConstraint<T, R>[];
  readonly $sort?: Record<string, SortDirection>;

  // Cursor pagination
  readonly query: Query<T, R> = this;
  readonly meta: QueryMeta = { page: { cursor: 'start', more: true } };
  readonly records: R[] = [];

  constructor(repository: Schema<T> | null, table: string, data: Partial<Query<T, R>>, parent?: Query<T, R>) {
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

type QueryOrConstraint<T, R> = Query<T, R> | Constraint<T>;

type QueryMeta = { page: { cursor: string; more: boolean } };

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

export type Selectable<T> = Omit<OmitQueries<OmitMethods<T>>, 'id' | 'xata'>;

export type Select<T, K extends keyof T> = Pick<T, K> & Queries<T> & XataObject;

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
export type Constraint<T> = { [key in Operator]?: T };

type DeepConstraint<T> = T extends Record<string, any>
  ? {
      [key in keyof T]?: T[key] | DeepConstraint<T[key]>;
    }
  : Constraint<T>;

export type ComparableType = number | Date;

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

function compactObject<T>(object: T): Partial<T> {
  return Object.entries(object).reduce((acc, [key, value]) => {
    // @ts-ignore TODO: Review
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {} as Partial<T>);
}
