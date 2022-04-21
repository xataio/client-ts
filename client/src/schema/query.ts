import { Repository, XataRecord } from '..';
import { ColumnsFilter, FilterExpression, PageConfig, SortExpression } from '../api/schemas';
import { compact } from '../util/lang';
import { Constraint, DeepConstraint, FilterConstraints, SortDirection, SortFilter } from './filters';
import { Page, Paginable, PaginationOptions, PaginationQueryMeta, PAGINATION_MAX_SIZE } from './pagination';
import { Select, Selectable, SelectableColumn, ValueOfSelectableColumn } from './selection';

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

/**
 * Query objects contain the information of all filters, sorting, etc. to be included in the database query.
 *
 * Query objects are immutable. Any method that adds more constraints or options to the query will return
 * a new Query object containing the both the previous and the new constraints and options.
 */
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

  /**
   * Builds a new query object representing a logical OR between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  any(...queries: Query<T, R>[]): Query<T, R> {
    const $any = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $any } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  all(...queries: Query<T, R>[]): Query<T, R> {
    const $all = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $all } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical OR negating each subquery. In pseudo-code: !q1 OR !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  not(...queries: Query<T, R>[]): Query<T, R> {
    const $not = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $not } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND negating each subquery. In pseudo-code: !q1 AND !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  none(...queries: Query<T, R>[]): Query<T, R> {
    const $none = queries.map((query) => query.getQueryOptions().filter);
    return new Query<T, R>(this.#repository, this.#table, { filter: { $none } }, this.#data);
  }

  /**
   * Builds a new query object adding one or more constraints. Examples:
   *
   * ```
   * query.filter("columnName", columnValue)
   * query.filter({
   *   "columnName": columnValue
   * })
   * query.filter({
   *   "columnName": operator(columnValue) // Use gt, gte, lt, lte, startsWith,...
   * })
   * ```
   *
   * @param constraints
   * @returns A new Query object.
   */
  filter(constraints: FilterConstraints<T> | DeepConstraint<T>): Query<T, R>;
  filter<F extends SelectableColumn<T>>(
    column: F,
    value: ValueOfSelectableColumn<T, typeof column> | DeepConstraint<ValueOfSelectableColumn<T, typeof column>>
  ): Query<T, R>;
  filter(a: any, b?: any): Query<T, R> {
    if (arguments.length === 1) {
      const constraints = Object.entries(a).map(([column, constraint]) => ({ [column]: constraint as any }));
      const $all = compact([this.#data.filter.$all].flat().concat(constraints));

      return new Query<T, R>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    } else {
      const $all = compact([this.#data.filter.$all].flat().concat([{ [a]: b }]));

      return new Query<T, R>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    }
  }

  /**
   * Builds a new query with a new sort option.
   * @param column The column name.
   * @param direction The direction. Either ascending or descending.
   * @returns A new Query object.
   */
  sort<F extends keyof T>(column: F, direction: SortDirection): Query<T, R> {
    const sort = { ...this.#data.sort, [column]: direction };
    return new Query<T, R>(this.#repository, this.#table, { sort }, this.#data);
  }

  /**
   * Builds a new query specifying the set of columns to be returned in the query response.
   * @param columns Array of column names to be returned by the query.
   * @returns A new Query object.
   */
  select<K extends SelectableColumn<T>>(columns: K[]) {
    return new Query<T, Select<T, K>>(this.#repository, this.#table, { columns }, this.#data);
  }

  getPaginated<Options extends QueryOptions<T>>(
    options: Options = {} as Options
  ): Promise<Page<T, GetWithColumnOptions<T, R, typeof options>>> {
    return this.#repository.query(this, options);
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<R> {
    for await (const [record] of this.getIterator(1)) {
      yield record;
    }
  }

  async *getIterator<Options extends QueryOptions<T>>(
    chunk: number,
    options: Omit<Options, 'page'> = {} as Options
  ): AsyncGenerator<GetWithColumnOptions<T, R, typeof options>[]> {
    let offset = 0;
    let end = false;

    while (!end) {
      const { records, meta } = await this.getPaginated({ ...options, page: { size: chunk, offset } });
      yield records;

      offset += chunk;
      end = !meta.page.more;
    }
  }

  /**
   * Performs the query in the database and returns a set of results.
   * @param options Additional options to be used when performing the query.
   * @returns An array of records from the database.
   */
  async getMany<Options extends QueryOptions<T>>(
    options: Options = {} as Options
  ): Promise<GetWithColumnOptions<T, R, typeof options>[]> {
    const { records } = await this.getPaginated(options);
    return records;
  }

  /**
   * Performs the query in the database and returns all the results.
   * Warning: If there are a large number of results, this method can have performance implications.
   * @param options Additional options to be used when performing the query.
   * @returns An array of records from the database.
   */
  async getAll<Options extends QueryOptions<T>>(
    chunk = PAGINATION_MAX_SIZE,
    options: Omit<Options, 'page'> = {} as Options
  ): Promise<GetWithColumnOptions<T, R, typeof options>[]> {
    const results = [];

    for await (const page of this.getIterator(chunk, options)) {
      results.push(...page);
    }

    return results;
  }

  /**
   * Performs the query in the database and returns the first result.
   * @param options Additional options to be used when performing the query.
   * @returns The first record that matches the query, or null if no record matched the query.
   */
  async getOne<Options extends Omit<QueryOptions<T>, 'page'>>(
    options: Options = {} as Options
  ): Promise<GetWithColumnOptions<T, R, typeof options> | null> {
    const records = await this.getMany({ ...options, page: { size: 1 } });
    return records[0] || null;
  }

  /**async deleteAll(): Promise<number> {
    // TODO: Return number of affected rows
    return 0;
  }**/

  nextPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.firstPage(size, offset);
  }

  previousPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.firstPage(size, offset);
  }

  firstPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.getPaginated({ page: { size, offset } });
  }

  lastPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.getPaginated({ page: { size, offset, before: 'end' } });
  }

  hasNextPage(): boolean {
    return this.meta.page.more;
  }
}

/**
 * Helper type to read options and compute the correct type for the result values
 * T: Original type
 * R: Default destination type
 * Options: QueryOptions
 *
 * If the columns are overriden in the options, the result type is the pick of the original type and the columns
 * If the columns are not overriden, the result type is the default destination type
 */
type GetWithColumnOptions<T, R, Options> = Options extends { columns: SelectableColumn<T>[] }
  ? Select<T, Options['columns'][number]>
  : R;
