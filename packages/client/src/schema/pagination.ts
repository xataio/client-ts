import { Query } from './query';
import { XataRecord } from './record';

export type PaginationQueryMeta = { page: { cursor: string; more: boolean } };

export interface Paginable<Record extends XataRecord, Result extends XataRecord = Record> {
  meta: PaginationQueryMeta;
  records: Result[];

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
  readonly records: Result[];

  constructor(query: Query<Record, Result>, meta: PaginationQueryMeta, records: Result[] = []) {
    this.#query = query;
    this.meta = meta;
    this.records = records;
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
export type PaginationOptions = CursorNavigationOptions & OffsetNavigationOptions;

export const PAGINATION_MAX_SIZE = 200;
export const PAGINATION_DEFAULT_SIZE = 200;
export const PAGINATION_MAX_OFFSET = 800;
export const PAGINATION_DEFAULT_OFFSET = 0;
