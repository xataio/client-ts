import { isDefined, isObject } from '../util/lang';
import { DatabaseSchema } from './inference';
import { Query } from './query';
import { JSONData, XataRecord } from './record';

export type PaginationQueryMeta = { page: { cursor: string; more: boolean; size: number } };

export interface Paginable<
  Schema extends DatabaseSchema,
  TableName extends string,
  ObjectType,
  Result extends XataRecord = XataRecord<ObjectType>
> {
  meta: PaginationQueryMeta;
  records: PageRecordArray<Result>;

  nextPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>>;
  previousPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>>;
  startPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>>;
  endPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>>;

  hasNextPage(): boolean;
}

/**
 * A Page contains a set of results from a query plus metadata about the retrieved
 * set of values such as the cursor, required to retrieve additional records.
 */
export class Page<
  Schema extends DatabaseSchema,
  TableName extends string,
  ObjectType,
  Result extends XataRecord = XataRecord<ObjectType>
> implements Paginable<Schema, TableName, ObjectType, Result>
{
  #query: Query<Schema, TableName, ObjectType, Result>;
  /**
   * Page metadata, required to retrieve additional records.
   */
  readonly meta: PaginationQueryMeta;
  /**
   * The set of results for this page.
   */
  readonly records: PageRecordArray<Result>;

  constructor(query: Query<Schema, TableName, ObjectType, Result>, meta: PaginationQueryMeta, records: Result[] = []) {
    this.#query = query;
    this.meta = meta;
    this.records = new PageRecordArray(this, records);
  }

  /**
   * Retrieves the next page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The next page or results.
   */
  async nextPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, after: this.meta.page.cursor } });
  }

  /**
   * Retrieves the previous page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The previous page or results.
   */
  async previousPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, before: this.meta.page.cursor } });
  }

  /**
   * Retrieves the start page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The start page or results.
   */
  async startPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, start: this.meta.page.cursor } });
  }

  /**
   * Retrieves the end page of results.
   * @param size Maximum number of results to be retrieved.
   * @param offset Number of results to skip when retrieving the results.
   * @returns The end page or results.
   */
  async endPage(size?: number, offset?: number): Promise<Page<Schema, TableName, ObjectType, Result>> {
    return this.#query.getPaginated({ pagination: { size, offset, end: this.meta.page.cursor } });
  }

  /**
   * Shortcut method to check if there will be additional results if the next page of results is retrieved.
   * @returns Whether or not there will be additional results in the next page of results.
   */
  hasNextPage(): boolean {
    return this.meta.page.more;
  }
}

export type CursorNavigationOptions = { start?: string } | { end?: string } | { after?: string; before?: string };
export type OffsetNavigationOptions = { size?: number; offset?: number };

export const PAGINATION_MAX_SIZE = 1000;
export const PAGINATION_DEFAULT_SIZE = 20;
export const PAGINATION_MAX_OFFSET = 49000;
export const PAGINATION_DEFAULT_OFFSET = 0;

export function isCursorPaginationOptions(
  options: Record<string, unknown> | undefined | null
): options is CursorNavigationOptions {
  return (
    isDefined(options) &&
    (isDefined(options.start) || isDefined(options.end) || isDefined(options.after) || isDefined(options.before))
  );
}

export class RecordArray<Result extends XataRecord> extends Array<Result> {
  constructor(overrideRecords?: Result[]);
  constructor(...args: any[]) {
    super(...RecordArray.parseConstructorParams(...args));
  }

  static parseConstructorParams(...args: any[]) {
    // new <T>(arrayLength: number): T[]
    if (args.length === 1 && typeof args[0] === 'number') {
      return new Array(args[0]);
    }

    // new <T>(overrideRecords: Array | undefined): T[>]
    if (args.length <= 1 && Array.isArray(args[0] ?? [])) {
      const result = args[0] ?? [];
      return new Array(...result);
    }

    // <T>(...items: T[]): T[]
    return new Array(...args);
  }

  toArray(): Result[] {
    return new Array(...this);
  }

  toSerializable(): JSONData<Result>[] {
    return JSON.parse(this.toString());
  }

  toString(): string {
    return JSON.stringify(this.toArray());
  }

  map<U>(callbackfn: (value: Result, index: number, array: Result[]) => U, thisArg?: any): U[] {
    return this.toArray().map(callbackfn, thisArg);
  }
}

export class PageRecordArray<Result extends XataRecord> extends Array<Result> {
  #page: Paginable<any, any, Result, Result>;

  constructor(page: Paginable<any, any, any, Result>, overrideRecords?: Result[]);
  constructor(...args: any[]) {
    super(...PageRecordArray.parseConstructorParams(...args));

    // In the case of serialization/deserialization, the page might be lost
    this.#page = isObject(args[0]?.meta) ? args[0] : { meta: { page: { cursor: '', more: false } }, records: [] };
  }

  static parseConstructorParams(...args: any[]) {
    // new <T>(arrayLength: number): T[]
    if (args.length === 1 && typeof args[0] === 'number') {
      return new Array(args[0]);
    }

    // new <T>(page: Page, overrideRecords: Array | undefined): T[>]
    if (args.length <= 2 && isObject(args[0]?.meta) && Array.isArray(args[1] ?? [])) {
      const result = args[1] ?? args[0].records ?? [];
      return new Array(...result);
    }

    // <T>(...items: T[]): T[]
    return new Array(...args);
  }

  toArray(): Result[] {
    return new Array(...this);
  }

  toSerializable(): JSONData<Result>[] {
    return JSON.parse(this.toString());
  }

  toString(): string {
    return JSON.stringify(this.toArray());
  }

  map<U>(callbackfn: (value: Result, index: number, array: Result[]) => U, thisArg?: any): U[] {
    return this.toArray().map(callbackfn, thisArg);
  }

  /**
   * Retrieve next page of records
   *
   * @returns A new array of objects
   */
  async nextPage(size?: number, offset?: number): Promise<PageRecordArray<Result>> {
    const newPage = await this.#page.nextPage(size, offset);
    return new PageRecordArray(newPage);
  }

  /**
   * Retrieve previous page of records
   *
   * @returns A new array of objects
   */
  async previousPage(size?: number, offset?: number): Promise<PageRecordArray<Result>> {
    const newPage = await this.#page.previousPage(size, offset);
    return new PageRecordArray(newPage);
  }

  /**
   * Retrieve start page of records
   *
   * @returns A new array of objects
   */
  async startPage(size?: number, offset?: number): Promise<PageRecordArray<Result>> {
    const newPage = await this.#page.startPage(size, offset);
    return new PageRecordArray(newPage);
  }

  /**
   * Retrieve end page of records
   *
   * @returns A new array of objects
   */
  async endPage(size?: number, offset?: number): Promise<PageRecordArray<Result>> {
    const newPage = await this.#page.endPage(size, offset);
    return new PageRecordArray(newPage);
  }

  /**
   * @returns Boolean indicating if there is a next page
   */
  hasNextPage(): boolean {
    return this.#page.meta.page.more;
  }
}
