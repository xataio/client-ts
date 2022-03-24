import { XataRecord } from '..';
import { Query } from './query';

export type PaginationQueryMeta = { page: { cursor: string; more: boolean } };

export interface Paginable<T extends XataRecord, R extends XataRecord = T> {
  meta: PaginationQueryMeta;
  records: R[];

  nextPage(size?: number, offset?: number): Promise<Page<T, R>>;
  previousPage(size?: number, offset?: number): Promise<Page<T, R>>;
  firstPage(size?: number, offset?: number): Promise<Page<T, R>>;
  lastPage(size?: number, offset?: number): Promise<Page<T, R>>;

  hasNextPage(): boolean;
}

export class Page<T extends XataRecord, R extends XataRecord> implements Paginable<T, R> {
  #query: Query<T, R>;
  readonly meta: PaginationQueryMeta;
  readonly records: R[];

  constructor(query: Query<T, R>, meta: PaginationQueryMeta, records: R[] = []) {
    this.#query = query;
    this.meta = meta;
    this.records = records;
  }

  async nextPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.#query.getPaginated({ page: { size, offset, after: this.meta.page.cursor } });
  }

  async previousPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.#query.getPaginated({ page: { size, offset, before: this.meta.page.cursor } });
  }

  async firstPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.#query.getPaginated({ page: { size, offset, first: this.meta.page.cursor } });
  }

  async lastPage(size?: number, offset?: number): Promise<Page<T, R>> {
    return this.#query.getPaginated({ page: { size, offset, last: this.meta.page.cursor } });
  }

  // TODO: We need to add something on the backend if we want a hasPreviousPage
  hasNextPage(): boolean {
    return this.meta.page.more;
  }
}

export type CursorNavigationOptions = { first?: string } | { last?: string } | { after?: string; before?: string };
export type OffsetNavigationOptions = { size?: number; offset?: number };
export type PaginationOptions = CursorNavigationOptions & OffsetNavigationOptions;
