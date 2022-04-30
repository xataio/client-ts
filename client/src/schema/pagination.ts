import { Query } from './query';
import { XataRecord } from './record';
import { SelectableColumn, SelectedRecordPick } from './selection';

export type PaginationQueryMeta = { page: { cursor: string; more: boolean } };

export interface Paginable<T extends XataRecord, Columns extends SelectableColumn<T>[]> {
  meta: PaginationQueryMeta;
  records: SelectedRecordPick<T, Columns>[];

  nextPage(size?: number, offset?: number): Promise<Page<T, Columns>>;
  previousPage(size?: number, offset?: number): Promise<Page<T, Columns>>;
  firstPage(size?: number, offset?: number): Promise<Page<T, Columns>>;
  lastPage(size?: number, offset?: number): Promise<Page<T, Columns>>;

  hasNextPage(): boolean;
}

/**
 * A Page contains a set of results from a query plus metadata about the retrieved
 * set of values such as the cursor, required to retrieve additional records.
 */
export class Page<T extends XataRecord, Columns extends SelectableColumn<T>[] = ['*']>
  implements Paginable<T, Columns>
{
  #query: Query<T, Columns>;
  /**
   * Page metadata, required to retrieve additional records.
   */
  readonly meta: PaginationQueryMeta;
  /**
   * The set of results for this page.
   */
  readonly records: SelectedRecordPick<T, Columns>[];

  constructor(query: Query<T, Columns>, meta: PaginationQueryMeta, records: SelectedRecordPick<T, Columns>[] = []) {
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
  async nextPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
    return this.#query.getPaginated({ page: { size, offset, after: this.meta.page.cursor } });
  }

  /**
   * Retrieves the previous page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The previous page or results.
   */
  async previousPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
    return this.#query.getPaginated({ page: { size, offset, before: this.meta.page.cursor } });
  }

  /**
   * Retrieves the first page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The first page or results.
   */
  async firstPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
    return this.#query.getPaginated({ page: { size, offset, first: this.meta.page.cursor } });
  }

  /**
   * Retrieves the last page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The last page or results.
   */
  async lastPage(size?: number, offset?: number): Promise<Page<T, Columns>> {
    return this.#query.getPaginated({ page: { size, offset, last: this.meta.page.cursor } });
  }

  // TODO: We need to add something on the backend if we want a hasPreviousPage
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
