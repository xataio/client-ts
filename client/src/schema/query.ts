import { XataRecord, Repository } from '..';
import { FilterExpression, SortExpression, PageConfig, ColumnsFilter } from '../api/schemas';
import { compact } from '../util/lang';
import { Constraint, DeepConstraint, FilterConstraints, SortDirection, SortFilter } from './filters';
import { PaginationOptions, Page, Paginable, PaginationQueryMeta } from './pagination';
import { Selectable, SelectableColumn, Select } from './selection';

export type QueryOptions<T extends XataRecord> = {
  page?: PaginationOptions;
  columns?: Extract<keyof Selectable<T>, string>[];
  //filter?: FilterConstraints<T>;
  sort?: SortFilter<T> | SortFilter<T>[];
};

export type QueryTableOptions = {
  filter: FilterExpression;
  sort?: SortExpression;
  page?: PageConfig;
  columns?: ColumnsFilter;
};

export class Query<T extends XataRecord, R extends XataRecord = T> implements Paginable<T, R> {
  #table: string;
  #repository: Repository<T>;
  #data: QueryTableOptions = { filter: {} };

  // Implements pagination
  readonly meta: PaginationQueryMeta = { page: { cursor: 'start', more: true } };
  readonly records: R[] = [];

  constructor(
    repository: Repository<T> | null,
    table: string,
    data: Partial<QueryTableOptions>,
    parent?: Partial<QueryTableOptions>
  ) {
    this.#table = table;

    if (repository) {
      this.#repository = repository;
    } else {
      this.#repository = this as any;
    }

    this.#data.filter.$any = data.filter?.$any ?? parent?.filter?.$any;
    this.#data.filter.$all = data.filter?.$all ?? parent?.filter?.$all;
    this.#data.filter.$not = data.filter?.$not ?? parent?.filter?.$not;
    this.#data.filter.$none = data.filter?.$none ?? parent?.filter?.$none;
    this.#data.sort = data.sort ?? parent?.sort;
    this.#data.columns = data.columns ?? parent?.columns ?? ['*'];

    this.any = this.any.bind(this);
    this.all = this.all.bind(this);
    this.not = this.not.bind(this);
    this.filter = this.filter.bind(this);
    this.sort = this.sort.bind(this);
    this.none = this.none.bind(this);

    Object.defineProperty(this, 'table', { enumerable: false });
    Object.defineProperty(this, 'repository', { enumerable: false });
  }

  getQueryOptions(): QueryTableOptions {
    return this.#data;
  }

  any(...queries: Query<T, R>[]): Query<T, R> {
    const $any = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $any } }, this.#data);
  }

  all(...queries: Query<T, R>[]): Query<T, R> {
    const $all = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $all } }, this.#data);
  }

  not(...queries: Query<T, R>[]): Query<T, R> {
    const $not = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $not } }, this.#data);
  }

  none(...queries: Query<T, R>[]): Query<T, R> {
    const $none = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $none } }, this.#data);
  }

  filter(constraints: FilterConstraints<T>): Query<T, R>;
  filter<F extends keyof Selectable<T>>(column: F, value: FilterConstraints<T[F]> | DeepConstraint<T[F]>): Query<T, R>;
  filter(a: any, b?: any): Query<T, R> {
    if (arguments.length === 1) {
      const constraints = Object.entries(a).map(([column, constraint]) => ({ [column]: constraint as any }));
      const $all = compact([this.#data.filter.$all].flat().concat(constraints));

      return new Query<T, R>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    } else {
      const column = a as keyof Selectable<T>;
      const value = b as FilterConstraints<T[typeof a]> | DeepConstraint<T[typeof a]>;
      const $all = compact([this.#data.filter.$all].flat().concat({ [column]: value }));

      return new Query<T, R>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    }
  }

  sort<F extends keyof T>(column: F, direction: SortDirection): Query<T, R> {
    const sort = { ...this.#data.sort, [column]: direction };
    return new Query<T, R>(this.#repository, this.#table, { sort }, this.#data);
  }

  select<K extends SelectableColumn<T>>(columns: K[]) {
    return new Query<T, Select<T, K>>(this.#repository, this.#table, { columns }, this.#data);
  }

  async getPaginated<Options extends QueryOptions<T>>(
    options: Options = {} as Options
  ): Promise<
    Page<T, typeof options['columns'] extends SelectableColumn<T>[] ? Select<T, typeof options['columns'][number]> : R>
  > {
    return this.#repository.query(this, options);
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

  /**async deleteAll(): Promise<number> {
    // TODO: Return number of affected rows
    return 0;
  }**/

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
