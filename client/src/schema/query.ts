import { FilterExpression } from '../api/schemas';
import { compact } from '../util/lang';
import { NonEmptyArray, RequiredBy } from '../util/types';
import { DeepConstraint, FilterConstraints, SortDirection, SortFilter } from './filters';
import { Page, Paginable, PaginationOptions, PaginationQueryMeta, PAGINATION_MAX_SIZE } from './pagination';
import { XataRecord } from './record';
import { Repository } from './repository';
import { SelectableColumn, SelectedRecordPick, ValueAtColumn } from './selection';

export type QueryOptions<T extends XataRecord> = {
  page?: PaginationOptions;
  columns?: NonEmptyArray<SelectableColumn<T>>;
  filter?: FilterExpression;
  sort?: SortFilter<T> | SortFilter<T>[];
};

/**
 * Query objects contain the information of all filters, sorting, etc. to be included in the database query.
 *
 * Query objects are immutable. Any method that adds more constraints or options to the query will return
 * a new Query object containing the both the previous and the new constraints and options.
 */
export class Query<Record extends XataRecord, Result extends XataRecord = Record> implements Paginable<Record, Result> {
  #table: string;
  #repository: Repository<Record>;
  #data: QueryOptions<Record> = { filter: {} };

  // Implements pagination
  readonly meta: PaginationQueryMeta = { page: { cursor: 'start', more: true } };
  readonly records: Result[] = [];

  constructor(
    repository: Repository<Record> | null,
    table: string,
    data: Partial<QueryOptions<Record>>,
    parent?: Partial<QueryOptions<Record>>
  ) {
    this.#table = table;

    if (repository) {
      this.#repository = repository;
    } else {
      this.#repository = this as any;
    }

    this.#data.filter = {};
    this.#data.filter.$any = data.filter?.$any ?? parent?.filter?.$any;
    this.#data.filter.$all = data.filter?.$all ?? parent?.filter?.$all;
    this.#data.filter.$not = data.filter?.$not ?? parent?.filter?.$not;
    this.#data.filter.$none = data.filter?.$none ?? parent?.filter?.$none;
    this.#data.sort = data.sort ?? parent?.sort;
    this.#data.columns = data.columns ?? parent?.columns ?? ['*'];
    this.#data.page = data.page ?? parent?.page;

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

  /**
   * Builds a new query object representing a logical OR between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  any(...queries: Query<Record, Result>[]): Query<Record, Result> {
    const $any = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $any } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  all(...queries: Query<Record, Result>[]): Query<Record, Result> {
    const $all = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $all } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical OR negating each subquery. In pseudo-code: !q1 OR !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  not(...queries: Query<Record, Result>[]): Query<Record, Result> {
    const $not = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $not } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND negating each subquery. In pseudo-code: !q1 AND !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  none(...queries: Query<Record, Result>[]): Query<Record, Result> {
    const $none = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<Record, Result>(this.#repository, this.#table, { filter: { $none } }, this.#data);
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
  filter(constraints: FilterConstraints<Record>): Query<Record, Result>;
  filter<F extends SelectableColumn<Record>>(
    column: F,
    value: FilterConstraints<ValueAtColumn<Record, F>> | DeepConstraint<ValueAtColumn<Record, F>>
  ): Query<Record, Result>;
  filter(a: any, b?: any): Query<Record, Result> {
    if (arguments.length === 1) {
      const constraints = Object.entries(a).map(([column, constraint]) => ({ [column]: constraint as any }));
      const $all = compact([this.#data.filter?.$all].flat().concat(constraints));

      return new Query<Record, Result>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    } else {
      const $all = compact([this.#data.filter?.$all].flat().concat([{ [a]: b }]));

      return new Query<Record, Result>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    }
  }

  /**
   * Builds a new query with a new sort option.
   * @param column The column name.
   * @param direction The direction. Either ascending or descending.
   * @returns A new Query object.
   */
  sort<F extends SelectableColumn<Record>>(column: F, direction: SortDirection): Query<Record, Result> {
    const originalSort = [this.#data.sort ?? []].flat() as SortFilter<Record>[];
    const sort = [...originalSort, { column, direction }];
    return new Query<Record, Result>(this.#repository, this.#table, { sort }, this.#data);
  }

  /**
   * Builds a new query specifying the set of columns to be returned in the query response.
   * @param columns Array of column names to be returned by the query.
   * @returns A new Query object.
   */
  select<K extends SelectableColumn<Record>>(columns: NonEmptyArray<K>) {
    return new Query<Record, SelectedRecordPick<Record, typeof columns>>(
      this.#repository,
      this.#table,
      { columns },
      this.#data
    );
  }

  getPaginated(): Promise<Page<Record, Result>>;
  getPaginated(options: Omit<QueryOptions<Record>, 'columns'>): Promise<Page<Record, Result>>;
  getPaginated<Options extends RequiredBy<QueryOptions<Record>, 'columns'>>(
    options: Options
  ): Promise<Page<Record, SelectedRecordPick<Record, typeof options['columns']>>>;
  getPaginated<Result extends XataRecord>(options: QueryOptions<Record> = {}): Promise<Page<Record, Result>> {
    const query = new Query<Record, Result>(this.#repository, this.#table, options, this.#data);
    return this.#repository.query(query);
  }

  async *[Symbol.asyncIterator]() {
    for await (const [record] of this.getIterator(1)) {
      yield record;
    }
  }

  async *getIterator<Options extends QueryOptions<Record>>(
    chunk: number,
    options: Omit<Options, 'page'> = {} as Options
  ) {
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
  getMany(): Promise<Result[]>;
  getMany(options: Omit<QueryOptions<Record>, 'columns'>): Promise<Result[]>;
  getMany<Options extends RequiredBy<QueryOptions<Record>, 'columns'>>(
    options: Options
  ): Promise<SelectedRecordPick<Record, typeof options['columns']>[]>;
  async getMany<Result extends XataRecord>(options: QueryOptions<Record> = {}): Promise<Result[]> {
    const { records } = await this.getPaginated(options);
    // @ts-ignore
    return records;
  }

  /**
   * Performs the query in the database and returns all the results.
   * Warning: If there are a large number of results, this method can have performance implications.
   * @param options Additional options to be used when performing the query.
   * @returns An array of records from the database.
   */
  async getAll<Options extends QueryOptions<Record>>(
    chunk = PAGINATION_MAX_SIZE,
    options: Omit<Options, 'page'> = {} as Options
  ) {
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
  getOne(): Promise<Result | null>;
  getOne(options: Omit<QueryOptions<Record>, 'columns'>): Promise<Result | null>;
  getOne<Options extends RequiredBy<QueryOptions<Record>, 'columns'>>(
    options: Options
  ): Promise<SelectedRecordPick<Record, typeof options['columns']> | null>;
  async getOne<Result extends XataRecord>(options: QueryOptions<Record> = {}): Promise<Result | null> {
    const records = await this.getMany({ ...options, page: { size: 1 } });
    // @ts-ignore
    return records[0] || null;
  }

  nextPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.firstPage(size, offset);
  }

  previousPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.firstPage(size, offset);
  }

  firstPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.getPaginated({ page: { size, offset } });
  }

  lastPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.getPaginated({ page: { size, offset, before: 'end' } });
  }

  hasNextPage(): boolean {
    return this.meta.page.more;
  }
}

type SafeColumns<
  T extends XataRecord,
  Options extends { columns?: SelectableColumn<T>[] },
  DefaultColumns extends SelectableColumn<T>[]
> = Options['columns'] extends SelectableColumn<T>[] ? Options['columns'] : DefaultColumns;
