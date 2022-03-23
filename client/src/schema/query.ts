import { XataRecord, Repository } from '..';
import { Constraint, DeepConstraint, FilterConstraints, SortDirection, SortFilter } from './filters';
import { PaginationOptions, BasePage, PaginationQueryMeta, Page } from './pagination';
import { Selectable, SelectableColumn, Select } from './selection';

export type QueryOptions<T> = {
  page?: PaginationOptions;
  columns?: Array<keyof Selectable<T>>;
  //filter?: FilterConstraints<T>;
  sort?: SortFilter<T> | SortFilter<T>[];
};

type QueryOrConstraint<T extends XataRecord, R extends XataRecord> = Query<T, R> | Constraint<T>;

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
  readonly meta: PaginationQueryMeta = { page: { cursor: 'start', more: true } };
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

  async getPaginated<Options extends QueryOptions<T>>(
    options: Options = {} as Options
  ): Promise<
    Page<T, typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R>
  > {
    return this.repository._runQuery(this, options);
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<R> {
    for await (const [record] of this.getIterator(1)) {
      yield record;
    }
  }

  async *getIterator(chunk: number, options: Omit<QueryOptions<T>, 'page'> = {}): AsyncGenerator<R[]> {
    let offset = 0;
    let end = false;

    while (!end) {
      const { records, meta } = await this.getPaginated({ ...options, page: { size: chunk, offset } });
      yield records;

      offset += chunk;
      end = !meta.page.more;
    }
  }

  async getMany<Options extends QueryOptions<T>>(
    options: Options = {} as Options
  ): Promise<
    (typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R)[]
  > {
    const { records } = await this.getPaginated(options);
    return records;
  }

  async getOne<Options extends Omit<QueryOptions<T>, 'page'>>(
    options: Options = {} as Options
  ): Promise<
    (typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R) | null
  > {
    const records = await this.getMany({ ...options, page: { size: 1 } });
    return records[0] || null;
  }

  async deleteAll(): Promise<number> {
    // TODO: Return number of affected rows
    return 0;
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
