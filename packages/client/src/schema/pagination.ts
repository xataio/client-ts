import { isDefined } from '../util/lang';
import { Query } from './query';
import { XataRecord } from './record';

export type PaginationQueryMeta = { page: { cursor: string; more: boolean } };

export interface Paginable<Record extends XataRecord, Result extends XataRecord = Record> {
  meta: PaginationQueryMeta;
  records: RecordArray<Result>;

  nextPage(size?: number, offset?: number): Promise<Page<Record, Result>>;
  previousPage(size?: number, offset?: number): Promise<Page<Record, Result>>;
  firstPage(size?: number, offset?: number): Promise<Page<Record, Result>>;
  lastPage(size?: number, offset?: number): Promise<Page<Record, Result>>;

  hasNextPage(): boolean;
}

/**
 * A Page contains a set of results from a query plus metadata about the retrieved
 * set of values such as the cursor, required to retrieve additional records.
 */
export class Page<Record extends XataRecord, Result extends XataRecord = Record> implements Paginable<Record, Result> {
  #query: Query<Record, Result>;
  /**
   * Page metadata, required to retrieve additional records.
   */
  readonly meta: PaginationQueryMeta;
  /**
   * The set of results for this page.
   */
  readonly records: RecordArray<Result>;

  constructor(query: Query<Record, Result>, meta: PaginationQueryMeta, records: Result[] = []) {
    this.#query = query;
    this.meta = meta;
    this.records = new RecordArray(this, records);
  }

  /**
   * Retrieves the next page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The next page or results.
   */
  async nextPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, after: this.meta.page.cursor } });
  }

  /**
   * Retrieves the previous page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The previous page or results.
   */
  async previousPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, before: this.meta.page.cursor } });
  }

  /**
   * Retrieves the first page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The first page or results.
   */
  async firstPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, first: this.meta.page.cursor } });
  }

  /**
   * Retrieves the last page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The last page or results.
   */
  async lastPage(size?: number, offset?: number): Promise<Page<Record, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, last: this.meta.page.cursor } });
  }

  /**
   * Shortcut method to check if there will be additional results if the next page of results is retrieved.
   * @returns Whether or not there will be additional results in the next page of results.
   */
  hasNextPage(): boolean {
    return this.meta.page.more;
  }
}

export type CursorNavigationOptions = { first?: string } | { last?: string } | { after?: string; before?: string };
export type OffsetNavigationOptions = { size?: number; offset?: number };

export const PAGINATION_MAX_SIZE = 200;
export const PAGINATION_DEFAULT_SIZE = 20;
export const PAGINATION_MAX_OFFSET = 800;
export const PAGINATION_DEFAULT_OFFSET = 0;

export function isCursorPaginationOptions(
  options: Record<string, unknown> | undefined | null
): options is CursorNavigationOptions {
  return (
    isDefined(options) &&
    (isDefined(options.first) || isDefined(options.last) || isDefined(options.after) || isDefined(options.before))
  );
}

export class RecordArray<Result extends XataRecord> extends Array<Result> {
  #page: Paginable<Result, Result>;

  constructor(page: Paginable<any, Result>, overrideRecords?: Result[]) {
    super(...RecordArray.parseConstructorParams(page, overrideRecords));
    this.#page = page;
  }

  static parseConstructorParams(...args: any[]) {
    // new <T>(arrayLength: number): T[]
    if (typeof args[0] === 'number') {
      return [];
    }

    // new RecordArray(page, [])
    if (args.length <= 2 && Array.isArray(args[0].records) && Array.isArray(args[1] ?? [])) {
      return new Array(...(args[0].records ?? args[1]));
    }

    // <T>(...items: T[]): T[]
    return new Array(...args);
  }

  /**
   * Retrieve next page of records
   *
   * @returns A new array of objects
   */
  async nextPage(size?: number, offset?: number): Promise<RecordArray<Result>> {
    const newPage = await this.#page.nextPage(size, offset);
    return new RecordArray(newPage);
  }

  /**
   * Retrieve previous page of records
   *
   * @returns A new array of objects
   */
  async previousPage(size?: number, offset?: number): Promise<RecordArray<Result>> {
    const newPage = await this.#page.previousPage(size, offset);
    return new RecordArray(newPage);
  }

  /**
   * Retrieve first page of records
   *
   * @returns A new array of objects
   */
  async firstPage(size?: number, offset?: number): Promise<RecordArray<Result>> {
    const newPage = await this.#page.firstPage(size, offset);
    return new RecordArray(newPage);
  }

  /**
   * Retrieve last page of records
   *
   * @returns A new array of objects
   */
  async lastPage(size?: number, offset?: number): Promise<RecordArray<Result>> {
    const newPage = await this.#page.lastPage(size, offset);
    return new RecordArray(newPage);
  }

  /**
   * @returns Boolean indicating if there is a next page
   */
  hasNextPage(): boolean {
    return this.#page.meta.page.more;
  }
}
