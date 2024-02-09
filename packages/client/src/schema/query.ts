import { Schemas } from '../api';
import { FilterExpression } from '../api/schemas';
import { compact, isDefined, isObject, isString, isStringArray, toBase64 } from '../util/lang';
import { Dictionary, OmitBy, RequiredBy, SingleOrArray } from '../util/types';
import { Filter, FilterColumns, FilterValueAtColumn, JSONFilterColumns } from './filters';
import {
  CursorNavigationOptions,
  OffsetNavigationOptions,
  PAGINATION_DEFAULT_SIZE,
  PAGINATION_MAX_SIZE,
  Page,
  Paginable,
  PaginationQueryMeta,
  PageRecordArray,
  isCursorPaginationOptions,
  RecordArray
} from './pagination';
import { XataRecord } from './record';
import { RestRepository } from './repository';
import { SelectableColumn, SelectableColumnWithObjectNotation, SelectedPick } from './selection';
import { SortColumns, SortDirection, SortFilter } from './sorting';
import { SummarizeExpression, SummarizeParams, SummarizeResult } from './summarize';

type BaseOptions<T extends XataRecord> = {
  columns?: SelectableColumnWithObjectNotation<T>[];
  consistency?: 'strong' | 'eventual';
  cache?: number;
  fetchOptions?: Record<string, unknown>;
};

type CursorQueryOptions = {
  pagination?: CursorNavigationOptions & OffsetNavigationOptions;
  filter?: never;
  sort?: never;
};

type OffsetQueryOptions<T extends XataRecord> = {
  pagination?: OffsetNavigationOptions;
  filter?: FilterExpression;
  sort?: SingleOrArray<SortFilter<T>>;
};

export type QueryOptions<T extends XataRecord> = BaseOptions<T> & (CursorQueryOptions | OffsetQueryOptions<T>);

/**
 * Query objects contain the information of all filters, sorting, etc. to be included in the database query.
 *
 * Query objects are immutable. Any method that adds more constraints or options to the query will return
 * a new Query object containing the both the previous and the new constraints and options.
 */
export class Query<Record extends XataRecord, Result extends XataRecord = Record> implements Paginable<Record, Result> {
  #table: { name: string; schema?: Schemas.Table };
  #repository: RestRepository<Record>;
  #data: QueryOptions<Record> = { filter: {} };

  // Implements pagination
  readonly meta: PaginationQueryMeta = { page: { cursor: 'start', more: true, size: PAGINATION_DEFAULT_SIZE } };
  readonly records: PageRecordArray<Result> = new PageRecordArray<Result>(this, []);

  constructor(
    repository: RestRepository<Record> | null,
    table: { name: string; schema?: Schemas.Table },
    data: Partial<QueryOptions<Record>>,
    rawParent?: Partial<QueryOptions<Record>>
  ) {
    this.#table = table;

    if (repository) {
      this.#repository = repository;
    } else {
      this.#repository = this as any;
    }

    // Clean parent query options if new query is cursor based
    const parent = cleanParent(data, rawParent);

    this.#data.filter = data.filter ?? parent?.filter ?? {};
    this.#data.filter.$any = data.filter?.$any ?? parent?.filter?.$any;
    this.#data.filter.$all = data.filter?.$all ?? parent?.filter?.$all;
    this.#data.filter.$not = data.filter?.$not ?? parent?.filter?.$not;
    this.#data.filter.$none = data.filter?.$none ?? parent?.filter?.$none;
    this.#data.sort = (data.sort ?? parent?.sort) as QueryOptions<Record>['sort']; // Fix for TS =4.7
    this.#data.columns = data.columns ?? parent?.columns;
    this.#data.consistency = data.consistency ?? parent?.consistency;
    this.#data.pagination = data.pagination ?? parent?.pagination;
    this.#data.cache = data.cache ?? parent?.cache;
    this.#data.fetchOptions = data.fetchOptions ?? parent?.fetchOptions;

    this.any = this.any.bind(this);
    this.all = this.all.bind(this);
    this.not = this.not.bind(this);
    this.filter = this.filter.bind(this);
    this.sort = this.sort.bind(this);
    this.none = this.none.bind(this);

    Object.defineProperty(this, 'table', { enumerable: false });
    Object.defineProperty(this, 'repository', { enumerable: false });
  }

  getQueryOptions(): QueryOptions<Record> {
    return this.#data;
  }

  key(): string {
    const { columns = [], filter = {}, sort = [], pagination = {} } = this.#data;
    const key = JSON.stringify({ columns, filter, sort, pagination });
    return toBase64(key);
  }

  /**
   * Builds a new query object representing a logical OR between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  any(...queries: Query<Record, any>[]): Query<Record, Result> {
    const $any = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $any } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  all(...queries: Query<Record, any>[]): Query<Record, Result> {
    const $all = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $all } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical OR negating each subquery. In pseudo-code: !q1 OR !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  not(...queries: Query<Record, any>[]): Query<Record, Result> {
    const $not = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $not } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND negating each subquery. In pseudo-code: !q1 AND !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  none(...queries: Query<Record, any>[]): Query<Record, Result> {
    const $none = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $none } }, this.#data);
  }

  /**
   * Builds a new query object adding one or more constraints. Examples:
   *
   * ```
   * query.filter("columnName", columnValue)
   * query.filter("columnName", operator(columnValue)) // Use gt, gte, lt, lte, startsWith,...
   * ```
   *
   * @param column The name of the column to filter.
   * @param value The value to filter.
   * @returns A new Query object.
   */
  filter<F extends FilterColumns<Record> | JSONFilterColumns<Record>>(
    column: F,
    value: FilterValueAtColumn<Record, F>
  ): Query<Record, Result>;

  /**
   * Builds a new query object adding one or more constraints. Examples:
   *
   * ```
   * query.filter({ "columnName": columnValue })
   * query.filter({
   *   "columnName": operator(columnValue) // Use gt, gte, lt, lte, startsWith,...
   * })
   * ```
   *
   * @param filter A filter object
   * @returns A new Query object.
   */
  filter(filter?: Filter<Record>): Query<Record, Result>;

  filter(a: any, b?: any): Query<Record, Result> {
    if (arguments.length === 1) {
      const constraints = Object.entries(a ?? {}).map(([column, constraint]) => ({
        [column]: this.#cleanFilterConstraint(column, constraint) as any
      }));
      const $all = compact([this.#data.filter?.$all].flat().concat(constraints));

      return new Query<Record, Result>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    } else {
      const constraints = isDefined(a) && isDefined(b) ? [{ [a]: this.#cleanFilterConstraint(a, b) }] : undefined;
      const $all = compact([this.#data.filter?.$all].flat().concat(constraints));

      return new Query<Record, Result>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    }
  }

  #cleanFilterConstraint<T>(column: string, value: T) {
    const columnType = this.#table.schema?.columns.find(({ name }) => name === column)?.type;

    // TODO: Fix when we support more array types than string
    if (columnType === 'multiple' && (isString(value) || isStringArray(value))) {
      return { $includes: value };
    }

    if (columnType === 'link' && isObject(value) && isString(value.id)) {
      return value.id;
    }

    return value;
  }

  /**
   * Builds a new query with a new sort option.
   * @param column The column name.
   * @param direction The direction. Either ascending or descending.
   * @returns A new Query object.
   */
  sort<F extends SortColumns<Record>>(column: F, direction: SortDirection): Query<Record, Result>;
  sort(column: '*', direction: 'random'): Query<Record, Result>;
  sort<F extends SortColumns<Record>>(column: F): Query<Record, Result>;
  sort(column: string, direction = 'asc'): Query<Record, Result> {
    const originalSort = [this.#data.sort ?? []].flat() as SortFilter<Record, any>[];
    const sort = [...originalSort, { column, direction }];
    return new Query<Record, Result>(this.#repository, this.#table, { sort }, this.#data);
  }

  /**
   * Builds a new query specifying the set of columns to be returned in the query response.
   * @param columns Array of column names to be returned by the query.
   * @returns A new Query object.
   */
  select<K extends SelectableColumnWithObjectNotation<Record>>(columns: K[]) {
    return new Query<Record, SelectedPick<Record, typeof columns>>(
      this.#repository,
      this.#table,
      { columns },
      this.#data
    );
  }

  /**
   * Get paginated results
   *
   * @returns A page of results
   */
  getPaginated(): Promise<Page<Record, Result>>;

  /**
   * Get paginated results
   *
   * @param options Pagination options
   * @returns A page of results
   */
  getPaginated(options: OmitBy<QueryOptions<Record>, 'columns'>): Promise<Page<Record, Result>>;

  /**
   * Get paginated results
   *
   * @param options Pagination options
   * @returns A page of results
   */
  getPaginated<Options extends RequiredBy<QueryOptions<Record>, 'columns'>>(
    options: Options
  ): Promise<Page<Record, SelectedPick<Record, (typeof options)['columns']>>>;

  getPaginated<Result extends XataRecord>(options: QueryOptions<Record> = {}): Promise<Page<Record, Result>> {
    const query = new Query<Record, Result>(this.#repository, this.#table, options, this.#data);
    return this.#repository.query(query);
  }

  /**
   * Get results in an iterator
   *
   * @async
   * @returns Async interable of results
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<Result> {
    for await (const [record] of this.getIterator({ batchSize: 1 })) {
      yield record;
    }
  }

  /**
   * Build an iterator of results
   *
   * @returns Async generator of results array
   */
  getIterator(): AsyncGenerator<Result[]>;

  /**
   * Build an iterator of results
   *
   * @param options Pagination options with batchSize
   * @returns Async generator of results array
   */
  getIterator(
    options: OmitBy<QueryOptions<Record>, 'columns' | 'pagination'> & { batchSize?: number }
  ): AsyncGenerator<Result[]>;

  /**
   * Build an iterator of results
   *
   * @param options Pagination options with batchSize
   * @returns Async generator of results array
   */
  getIterator<
    Options extends RequiredBy<OmitBy<QueryOptions<Record>, 'pagination'>, 'columns'> & { batchSize?: number }
  >(options: Options): AsyncGenerator<SelectedPick<Record, (typeof options)['columns']>[]>;

  async *getIterator<Result extends XataRecord>(
    options: QueryOptions<Record> & { batchSize?: number } = {}
  ): AsyncGenerator<Result[]> {
    const { batchSize = 1 } = options;

    let page = await this.getPaginated({ ...options, pagination: { size: batchSize, offset: 0 } });
    let more = page.hasNextPage();

    yield page.records as unknown as Result[];

    while (more) {
      page = await page.nextPage();
      more = page.hasNextPage();

      yield page.records as unknown as Result[];
    }
  }

  /**
   * Performs the query in the database and returns a set of results.
   * @returns An array of records from the database.
   */
  getMany(): Promise<PageRecordArray<Result>>;

  /**
   * Performs the query in the database and returns a set of results.
   * @param options Additional options to be used when performing the query.
   * @returns An array of records from the database.
   */
  getMany<Options extends RequiredBy<QueryOptions<Record>, 'columns'>>(
    options: Options
  ): Promise<PageRecordArray<SelectedPick<Record, (typeof options)['columns']>>>;

  /**
   * Performs the query in the database and returns a set of results.
   * @param options Additional options to be used when performing the query.
   * @returns An array of records from the database.
   */
  getMany(options: OmitBy<QueryOptions<Record>, 'columns'>): Promise<PageRecordArray<Result>>;

  async getMany<Result extends XataRecord>(options: QueryOptions<Record> = {}): Promise<PageRecordArray<Result>> {
    const { pagination = {}, ...rest } = options;
    const { size = PAGINATION_DEFAULT_SIZE, offset } = pagination;
    const batchSize = size <= PAGINATION_MAX_SIZE ? size : PAGINATION_MAX_SIZE;

    let page = await this.getPaginated({ ...rest, pagination: { size: batchSize, offset } });
    const results = [...page.records];

    while (page.hasNextPage() && results.length < size) {
      page = await page.nextPage();
      results.push(...page.records);
    }

    if (page.hasNextPage() && options.pagination?.size === undefined) {
      console.trace('Calling getMany does not return all results. Paginate to get all results or call getAll.');
    }

    const array = new PageRecordArray(page, results.slice(0, size));

    // Method overloading does not provide type inference for the return type.
    return array as unknown as PageRecordArray<Result>;
  }

  /**
   * Performs the query in the database and returns all the results.
   * Warning: If there are a large number of results, this method can have performance implications.
   * @returns An array of records from the database.
   */
  getAll(): Promise<RecordArray<Result>>;

  /**
   * Performs the query in the database and returns all the results.
   * Warning: If there are a large number of results, this method can have performance implications.
   * @param options Additional options to be used when performing the query.
   * @returns An array of records from the database.
   */
  getAll<Options extends RequiredBy<OmitBy<QueryOptions<Record>, 'pagination'>, 'columns'> & { batchSize?: number }>(
    options: Options
  ): Promise<RecordArray<SelectedPick<Record, (typeof options)['columns']>>>;

  /**
   * Performs the query in the database and returns all the results.
   * Warning: If there are a large number of results, this method can have performance implications.
   * @param options Additional options to be used when performing the query.
   * @returns An array of records from the database.
   */
  getAll(
    options: OmitBy<QueryOptions<Record>, 'columns' | 'pagination'> & { batchSize?: number }
  ): Promise<RecordArray<Result>>;

  async getAll<Result extends XataRecord>(
    options: QueryOptions<Record> & { batchSize?: number } = {}
  ): Promise<RecordArray<Result>> {
    const { batchSize = PAGINATION_MAX_SIZE, ...rest } = options;
    const results = [];

    for await (const page of this.getIterator({ ...rest, batchSize })) {
      results.push(...page);
    }

    // Method overloading does not provide type inference for the return type.
    return new RecordArray(results) as unknown as RecordArray<Result>;
  }

  /**
   * Performs the query in the database and returns the first result.
   * @returns The first record that matches the query, or null if no record matched the query.
   */
  getFirst(): Promise<Result | null>;

  /**
   * Performs the query in the database and returns the first result.
   * @param options Additional options to be used when performing the query.
   * @returns The first record that matches the query, or null if no record matched the query.
   */
  getFirst<Options extends RequiredBy<OmitBy<QueryOptions<Record>, 'pagination'>, 'columns'>>(
    options: Options
  ): Promise<SelectedPick<Record, (typeof options)['columns']> | null>;

  /**
   * Performs the query in the database and returns the first result.
   * @param options Additional options to be used when performing the query.
   * @returns The first record that matches the query, or null if no record matched the query.
   */
  getFirst(options: OmitBy<QueryOptions<Record>, 'columns' | 'pagination'>): Promise<Result | null>;

  async getFirst<Result extends XataRecord>(options: QueryOptions<Record> = {}): Promise<Result | null> {
    const records = await this.getMany({ ...options, pagination: { size: 1 } });

    // Method overloading does not provide type inference for the return type.
    return (records[0] as unknown as Result) ?? null;
  }

  /**
   * Performs the query in the database and returns the first result.
   * @returns The first record that matches the query, or null if no record matched the query.
   * @throws if there are no results.
   */
  getFirstOrThrow(): Promise<Result>;

  /**
   * Performs the query in the database and returns the first result.
   * @param options Additional options to be used when performing the query.
   * @returns The first record that matches the query, or null if no record matched the query.
   * @throws if there are no results.
   */
  getFirstOrThrow<Options extends RequiredBy<OmitBy<QueryOptions<Record>, 'pagination'>, 'columns'>>(
    options: Options
  ): Promise<SelectedPick<Record, (typeof options)['columns']>>;

  /**
   * Performs the query in the database and returns the first result.
   * @param options Additional options to be used when performing the query.
   * @returns The first record that matches the query, or null if no record matched the query.
   * @throws if there are no results.
   */
  getFirstOrThrow(options: OmitBy<QueryOptions<Record>, 'columns' | 'pagination'>): Promise<Result>;

  async getFirstOrThrow<Result extends XataRecord>(options: QueryOptions<Record> = {}): Promise<Result> {
    const records = await this.getMany({ ...options, pagination: { size: 1 } });
    if (records[0] === undefined) throw new Error('No results found.');

    // Method overloading does not provide type inference for the return type.
    return records[0] as unknown as Result;
  }

  async summarize<
    Expression extends Dictionary<SummarizeExpression<Record>>,
    Columns extends SelectableColumn<Record>[]
  >(params: SummarizeParams<Record, Expression, Columns> = {}): Promise<SummarizeResult<Record, Expression, Columns>> {
    const { summaries, summariesFilter, ...options } = params;
    const query = new Query<Record, Result>(
      this.#repository,
      this.#table,
      options as Partial<QueryOptions<Record>>,
      this.#data
    );

    return this.#repository.summarizeTable(query, summaries, summariesFilter as Schemas.FilterExpression) as any;
  }

  /**
   * Builds a new query object adding a cache TTL in milliseconds.
   * @param ttl The cache TTL in milliseconds.
   * @returns A new Query object.
   */
  cache(ttl: number): Query<Record, Result> {
    return new Query<Record, Result>(this.#repository, this.#table, { cache: ttl }, this.#data);
  }

  /**
   * Retrieve next page of records
   *
   * @returns A new page object.
   */
  nextPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.startPage(size, offset);
  }

  /**
   * Retrieve previous page of records
   *
   * @returns A new page object
   */
  previousPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.startPage(size, offset);
  }

  /**
   * Retrieve start page of records
   *
   * @returns A new page object
   */
  startPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.getPaginated({ pagination: { size, offset } });
  }

  /**
   * Retrieve last page of records
   *
   * @returns A new page object
   */
  endPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.getPaginated({ pagination: { size, offset, before: 'end' } });
  }

  /**
   * @returns Boolean indicating if there is a next page
   */
  hasNextPage(): boolean {
    return this.meta.page.more;
  }
}

// When using cursor based pagination, it is not allowed to send new sorting/filtering
// We removed the sorting/filtering from the query options to avoid the error from the API
function cleanParent<Record extends XataRecord>(
  data: Partial<QueryOptions<Record>>,
  parent?: Partial<QueryOptions<Record>>
) {
  if (isCursorPaginationOptions(data.pagination)) {
    return { ...parent, sort: undefined, filter: undefined };
  }

  return parent;
}
