import { FilterExpression } from '../api/schemas';
import { compact } from '../util/lang';
import { DeepConstraint, FilterConstraints, SortDirection, SortFilter } from './filters';
import { Page, Paginable, PaginationOptions, PaginationQueryMeta, PAGINATION_MAX_SIZE } from './pagination';
import { XataRecord } from './record';
import { Repository } from './repository';
import { SelectableColumn, SelectedRecordPick, ValueAtColumn } from './selection';

export type QueryOptions<T extends XataRecord> = {
  page?: PaginationOptions;
  columns?: SelectableColumn<T>[];
  filter?: FilterExpression;
  sort?: SortFilter<T> | SortFilter<T>[];
};

/**
 * Query objects contain the information of all filters, sorting, etc. to be included in the database query.
 *
 * Query objects are immutable. Any method that adds more constraints or options to the query will return
 * a new Query object containing the both the previous and the new constraints and options.
 */
export class Query<T extends XataRecord, Columns extends SelectableColumn<T>[]> implements Paginable<T, Columns> {
  #table: string;
  #repository: Repository<T>;
  #data: QueryOptions<T> = { filter: {} };

  // Implements pagination
  readonly meta: PaginationQueryMeta = { page: { cursor: 'start', more: true } };
  readonly records: SelectedRecordPick<T, Columns>[] = [];

  constructor(
    repository: Repository<T> | null,
    table: string,
    data: Partial<QueryOptions<T>>,
    parent?: Partial<QueryOptions<T>>
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

  getQueryOptions(): QueryOptions<T> {
    return this.#data;
  }

  /**
   * Builds a new query object representing a logical OR between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  any(...queries: Query<T, Columns>[]): Query<T, Columns> {
    const $any = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<T, Columns>(this.#repository, this.#table, { filter: { $any } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND between the given subqueries.
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  all(...queries: Query<T, Columns>[]): Query<T, Columns> {
    const $all = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<T, Columns>(this.#repository, this.#table, { filter: { $all } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical OR negating each subquery. In pseudo-code: !q1 OR !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  not(...queries: Query<T, Columns>[]): Query<T, Columns> {
    const $not = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<T, Columns>(this.#repository, this.#table, { filter: { $not } }, this.#data);
  }

  /**
   * Builds a new query object representing a logical AND negating each subquery. In pseudo-code: !q1 AND !q2
   * @param queries An array of subqueries.
   * @returns A new Query object.
   */
  none(...queries: Query<T, Columns>[]): Query<T, Columns> {
    const $none = queries.map((query) => query.getQueryOptions().filter ?? {});
    return new Query<T, Columns>(this.#repository, this.#table, { filter: { $none } }, this.#data);
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
  filter(constraints: FilterConstraints<T>): Query<T, Columns>;
  filter<F extends SelectableColumn<T>>(
    column: F,
    value: FilterConstraints<ValueAtColumn<T, F>> | DeepConstraint<ValueAtColumn<T, F>>
  ): Query<T, Columns>;
  filter(a: any, b?: any): Query<T, Columns> {
    if (arguments.length === 1) {
      const constraints = Object.entries(a).map(([column, constraint]) => ({ [column]: constraint as any }));
      const $all = compact([this.#data.filter?.$all].flat().concat(constraints));

      return new Query<T, Columns>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    } else {
      const $all = compact([this.#data.filter?.$all].flat().concat([{ [a]: b }]));

      return new Query<T, Columns>(this.#repository, this.#table, { filter: { $all } }, this.#data);
    }
  }

  /**
   * Builds a new query with a new sort option.
   * @param column The column name.
   * @param direction The direction. Either ascending or descending.
   * @returns A new Query object.
   */
  sort<F extends SelectableColumn<T>>(column: F, direction: SortDirection): Query<T, Columns> {
    const originalSort = [this.#data.sort ?? []].flat() as SortFilter<T>[];
    const sort = [...originalSort, { column, direction }];
    return new Query<T, Columns>(this.#repository, this.#table, { sort }, this.#data);
  }

  /**
   * Builds a new query specifying the set of columns to be returned in the query response.
   * @param columns Array of column names to be returned by the query.
   * @returns A new Query object.
   */
  select<K extends SelectableColumn<T>>(columns: K[]) {
    return new Query<T, typeof columns>(this.#repository, this.#table, { columns }, this.#data);
  }

  getPaginated<Options extends QueryOptions<T>>(
    options: Options = {} as Options
  ): Promise<Page<T, SafeColumns<T, Options, Columns>>> {
    const query = new Query<T, SafeColumns<T, Options, Columns>>(this.#repository, this.#table, options, this.#data);
    return this.#repository.query(query);
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<SelectedRecordPick<T, Columns>> {
    for await (const [record] of this.getIterator(1)) {
      yield record;
    }
  }

  async *getIterator<Options extends QueryOptions<T>>(chunk: number, options: Omit<Options, 'page'> = {} as Options) {
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
  async getMany<Options extends QueryOptions<T>>(options: Options = {} as Options) {
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
  async getOne<Options extends Omit<QueryOptions<T>, 'page'>>(options: Options = {} as Options) {
    const records = await this.getMany({ ...options, page: { size: 1 } });
    return records[0] || null;
  }

  nextPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
    return this.firstPage(size, offset);
  }

  previousPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
    return this.firstPage(size, offset);
  }

  firstPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
    return this.getPaginated({ page: { size, offset } });
  }

  lastPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
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
