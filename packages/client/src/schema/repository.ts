import { SchemaPluginResult } from '.';
import {
  bulkInsertTableRecords,
  deleteRecord,
  getBranchDetails,
  getRecord,
  insertRecord,
  insertRecordWithID,
  queryTable,
  Schemas,
  searchTable,
  updateRecordWithID,
  upsertRecordWithID
} from '../api';
import { FetcherExtraProps } from '../api/fetcher';
import { FuzzinessExpression, HighlightExpression, PrefixExpression, RecordsMetadata } from '../api/schemas';
import { XataPluginOptions } from '../plugins';
import { SearchXataRecord } from '../search';
import { Boosters } from '../search/boosters';
import { compact, isObject, isString, isStringArray } from '../util/lang';
import { Dictionary } from '../util/types';
import { VERSION } from '../version';
import { CacheImpl } from './cache';
import { Filter } from './filters';
import { Page } from './pagination';
import { Query } from './query';
import { BaseData, EditableData, Identifiable, isIdentifiable, XataRecord } from './record';
import { SelectableColumn, SelectedPick } from './selection';
import { buildSortFilter } from './sorting';
import { AttributeDictionary, defaultTrace, TraceAttributes, TraceFunction } from './tracing';

/**
 * Common interface for performing operations on a table.
 */
export abstract class Repository<Data extends BaseData, Record extends XataRecord = Data & XataRecord> extends Query<
  Record,
  Readonly<SelectedPick<Record, ['*']>>
> {
  /*
   * Creates a single record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract create<K extends SelectableColumn<Record>>(
    object: Omit<EditableData<Data>, 'id'> & Partial<Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /*
   * Creates a single record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(
    object: Omit<EditableData<Data>, 'id'> & Partial<Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates a single record in the table with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract create<K extends SelectableColumn<Record>>(
    id: string,
    object: Omit<EditableData<Data>, 'id'>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates a single record in the table with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(id: string, object: Omit<EditableData<Data>, 'id'>): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order.
   */
  abstract create<K extends SelectableColumn<Record>>(
    objects: Array<Omit<EditableData<Data>, 'id'> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records in order.
   */
  abstract create(
    objects: Array<Omit<EditableData<Data>, 'id'> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns> | null>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(id: string): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read<K extends SelectableColumn<Record>>(
    ids: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read(ids: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns> | null>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read<K extends SelectableColumn<Record>>(
    objects: Identifiable[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read(objects: Identifiable[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow(id: string): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<Record>>(
    ids: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow(ids: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<Record>>(
    objects: Identifiable[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow(objects: Identifiable[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update<K extends SelectableColumn<Record>>(
    object: Partial<EditableData<Data>> & Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update(
    object: Partial<EditableData<Data>> & Identifiable
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update<K extends SelectableColumn<Record>>(
    id: string,
    object: Partial<EditableData<Data>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update(
    id: string,
    object: Partial<EditableData<Data>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order (if a record could not be found null is returned).
   */
  abstract update<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @returns Array of the persisted records in order (if a record could not be found null is returned).
   */
  abstract update(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<Record>>(
    object: Partial<EditableData<Data>> & Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow(
    object: Partial<EditableData<Data>> & Identifiable
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<Record>>(
    id: string,
    object: Partial<EditableData<Data>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow(
    id: string,
    object: Partial<EditableData<Data>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order.
   * @throws If one or more records could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @returns Array of the persisted records in order.
   * @throws If one or more records could not be found.
   */
  abstract updateOrThrow(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrUpdate<K extends SelectableColumn<Record>>(
    object: EditableData<Data> & Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(object: EditableData<Data> & Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrUpdate<K extends SelectableColumn<Record>>(
    id: string,
    object: Omit<EditableData<Data>, 'id'>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(
    id: string,
    object: Omit<EditableData<Data>, 'id'>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records.
   */
  abstract createOrUpdate<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Data> & Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be update, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createOrUpdate(
    objects: Array<EditableData<Data> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete<K extends SelectableColumn<Record>>(
    object: Identifiable & Partial<EditableData<Data>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete(
    object: Identifiable & Partial<EditableData<Data>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete(id: string): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete<K extends SelectableColumn<Record>>(
    objects: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete(objects: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow(id: string): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @returns Array of the deleted records in order.
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow(objects: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;

  /**
   * Search for records in the table.
   * @param query The query to search for.
   * @param options The options to search with (like: fuzziness)
   * @returns The found records.
   */
  abstract search(
    query: string,
    options?: {
      fuzziness?: FuzzinessExpression;
      prefix?: PrefixExpression;
      highlight?: HighlightExpression;
      filter?: Filter<Record>;
      boosters?: Boosters<Record>[];
    }
  ): Promise<SearchXataRecord<SelectedPick<Record, ['*']>>[]>;

  abstract query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>>;
}

export class RestRepository<Data extends BaseData, Record extends XataRecord = Data & XataRecord>
  extends Query<Record, SelectedPick<Record, ['*']>>
  implements Repository<Data, Record>
{
  #table: string;
  #getFetchProps: () => Promise<FetcherExtraProps>;
  #db: SchemaPluginResult<any>;
  #cache: CacheImpl;
  #schemaTables?: Schemas.Table[];
  #trace: TraceFunction;

  constructor(options: {
    table: string;
    db: SchemaPluginResult<any>;
    pluginOptions: XataPluginOptions;
    schemaTables?: Schemas.Table[];
  }) {
    super(null, options.table, {});

    this.#table = options.table;
    this.#getFetchProps = options.pluginOptions.getFetchProps;
    this.#db = options.db;
    this.#cache = options.pluginOptions.cache;
    this.#schemaTables = options.schemaTables;

    const trace = options.pluginOptions.trace ?? defaultTrace;
    this.#trace = async <T>(
      name: string,
      fn: (options: { setAttributes: (attrs: AttributeDictionary) => void; onError: (message: string) => void }) => T,
      options: AttributeDictionary = {}
    ) => {
      return trace<T>(name, fn, {
        ...options,
        [TraceAttributes.TABLE]: this.#table,
        [TraceAttributes.VERSION]: VERSION
      });
    };
  }

  async create<K extends SelectableColumn<Record>>(
    object: EditableData<Data> & Partial<Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async create(object: EditableData<Data> & Partial<Identifiable>): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async create<K extends SelectableColumn<Record>>(
    id: string,
    object: EditableData<Data>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async create(id: string, object: EditableData<Data>): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async create<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Data> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async create(
    objects: Array<EditableData<Data> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async create<K extends SelectableColumn<Record>>(
    a: string | (EditableData<Data> & Partial<Identifiable>) | Array<EditableData<Data> & Partial<Identifiable>>,
    b?: EditableData<Data> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, K[]>>
    | Readonly<SelectedPick<Record, K[]>>[]
    | Readonly<SelectedPick<Record, ['*']>>
    | Readonly<SelectedPick<Record, ['*']>>[]
  > {
    return this.#trace('create', async () => {
      // Create many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const columns = isStringArray(b) ? b : undefined;
        return this.#bulkInsertTableRecords(a, columns);
      }

      // Create one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isStringArray(c) ? c : undefined;
        return this.#insertRecordWithId(a, b, columns);
      }

      // Create one record with id as property
      if (isObject(a) && isString(a.id)) {
        if (a.id === '') throw new Error("The id can't be empty");

        const columns = isStringArray(b) ? b : undefined;
        return this.#insertRecordWithId(a.id, { ...a, id: undefined }, columns);
      }

      // Create one record without id
      if (isObject(a)) {
        const columns = isStringArray(b) ? b : undefined;
        return this.#insertRecordWithoutId(a, columns);
      }

      throw new Error('Invalid arguments for create method');
    });
  }

  async #insertRecordWithoutId(object: EditableData<Data>, columns: SelectableColumn<Record>[] = ['*']) {
    const fetchProps = await this.#getFetchProps();

    const record = transformObjectLinks(object);

    const response = await insertRecord({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        tableName: this.#table
      },
      queryParams: { columns },
      body: record,
      ...fetchProps
    });

    const schemaTables = await this.#getSchemaTables();
    return initObject(this.#db, schemaTables, this.#table, response) as any;
  }

  async #insertRecordWithId(recordId: string, object: EditableData<Data>, columns: SelectableColumn<Record>[] = ['*']) {
    const fetchProps = await this.#getFetchProps();

    const record = transformObjectLinks(object);

    const response = await insertRecordWithID({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        tableName: this.#table,
        recordId
      },
      body: record,
      queryParams: { createOnly: true, columns },
      ...fetchProps
    });

    const schemaTables = await this.#getSchemaTables();
    return initObject(this.#db, schemaTables, this.#table, response) as any;
  }

  async #bulkInsertTableRecords(objects: EditableData<Data>[], columns: SelectableColumn<Record>[] = ['*']) {
    const fetchProps = await this.#getFetchProps();

    const records = objects.map((object) => transformObjectLinks(object));

    const response = await bulkInsertTableRecords({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
      queryParams: { columns },
      body: { records },
      ...fetchProps
    });

    if (!isResponseWithRecords(response)) {
      throw new Error("Request included columns but server didn't include them");
    }

    const schemaTables = await this.#getSchemaTables();
    return response.records?.map((item) => initObject(this.#db, schemaTables, this.#table, item)) as any;
  }

  async read<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns> | null>>;
  async read(id: string): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;
  async read<K extends SelectableColumn<Record>>(
    ids: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async read(ids: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async read<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns> | null>>;
  async read(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;
  async read<K extends SelectableColumn<Record>>(
    objects: Identifiable[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async read(objects: Identifiable[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async read<K extends SelectableColumn<Record>>(
    a: string | string[] | Identifiable | Identifiable[],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>> | null>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>> | null>
    | null
  > {
    return this.#trace('read', async () => {
      const columns = isStringArray(b) ? b : ['*' as const];

      // Read many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = a.map((item) => extractId(item));

        const finalObjects = await this.getAll({ filter: { id: { $any: compact(ids) } }, columns });

        // Maintain order of objects
        const dictionary = finalObjects.reduce((acc, object) => {
          acc[object.id] = object;
          return acc;
        }, {} as Dictionary<any>);

        return ids.map((id) => dictionary[id ?? ''] ?? null);
      }

      // Read one record
      const id = extractId(a);
      if (id) {
        const fetchProps = await this.#getFetchProps();

        try {
          const response = await getRecord({
            pathParams: {
              workspace: '{workspaceId}',
              dbBranchName: '{dbBranch}',
              tableName: this.#table,
              recordId: id
            },
            queryParams: { columns },
            ...fetchProps
          });

          const schemaTables = await this.#getSchemaTables();
          return initObject(this.#db, schemaTables, this.#table, response);
        } catch (e) {
          if (isObject(e) && e.status === 404) {
            return null;
          }

          throw e;
        }
      }

      return null;
    });
  }

  async readOrThrow<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async readOrThrow(id: string): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<Record>>(
    ids: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async readOrThrow(ids: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async readOrThrow<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async readOrThrow(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<Record>>(
    objects: Identifiable[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async readOrThrow(objects: Identifiable[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async readOrThrow<K extends SelectableColumn<Record>>(
    a: string | string[] | Identifiable | Identifiable[],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Readonly<SelectedPick<Record, ['*']>>[]
    | Readonly<SelectedPick<Record, K[]>>
    | Readonly<SelectedPick<Record, K[]>>[]
  > {
    return this.#trace('readOrThrow', async () => {
      const result = await this.read(a as any, b as any);

      if (Array.isArray(result)) {
        const missingIds = compact(
          (a as Array<string | Identifiable>)
            .filter((_item, index) => result[index] === null)
            .map((item) => extractId(item))
        );

        if (missingIds.length > 0) {
          throw new Error(`Could not find records with ids: ${missingIds.join(', ')}`);
        }

        return result as any;
      }

      if (result === null) {
        const id = extractId(a) ?? 'unknown';
        throw new Error(`Record with id ${id} not found`);
      }

      return result;
    });
  }

  async update<K extends SelectableColumn<Record>>(
    object: Partial<EditableData<Data>> & Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async update(
    object: Partial<EditableData<Data>> & Identifiable
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async update<K extends SelectableColumn<Record>>(
    id: string,
    object: Partial<EditableData<Data>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async update(id: string, object: Partial<EditableData<Data>>): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async update<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async update(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async update<K extends SelectableColumn<Record>>(
    a: string | (Partial<EditableData<Data>> & Identifiable) | Array<Partial<EditableData<Data>> & Identifiable>,
    b?: Partial<EditableData<Data>> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>> | null>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>> | null>
    | null
  > {
    return this.#trace('update', async () => {
      // Update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        if (a.length > 100) {
          // TODO: Implement bulk update when API has support for it
          console.warn('Bulk update operation is not optimized in the Xata API yet, this request might be slow');
        }

        const columns = isStringArray(b) ? b : (['*'] as K[]);
        return Promise.all(a.map((object) => this.update(object, columns)));
      }

      // Update one record with id as param
      if (isString(a) && isObject(b)) {
        const columns = isStringArray(c) ? c : undefined;
        return this.#updateRecordWithID(a, b, columns);
      }

      // Update one record with id as property
      if (isObject(a) && isString(a.id)) {
        const columns = isStringArray(b) ? b : undefined;
        return this.#updateRecordWithID(a.id, { ...a, id: undefined }, columns);
      }

      throw new Error('Invalid arguments for update method');
    });
  }

  async updateOrThrow<K extends SelectableColumn<Record>>(
    object: Partial<EditableData<Data>> & Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async updateOrThrow(
    object: Partial<EditableData<Data>> & Identifiable
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    id: string,
    object: Partial<EditableData<Data>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async updateOrThrow(id: string, object: Partial<EditableData<Data>>): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async updateOrThrow(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    a: string | (Partial<EditableData<Data>> & Identifiable) | Array<Partial<EditableData<Data>> & Identifiable>,
    b?: Partial<EditableData<Data>> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('updateOrThrow', async () => {
      const result = await this.update(a as any, b as any, c as any);

      if (Array.isArray(result)) {
        const missingIds = compact(
          (a as Array<string | Identifiable>)
            .filter((_item, index) => result[index] === null)
            .map((item) => extractId(item))
        );

        if (missingIds.length > 0) {
          throw new Error(`Could not find records with ids: ${missingIds.join(', ')}`);
        }

        return result as any;
      }

      if (result === null) {
        const id = extractId(a) ?? 'unknown';
        throw new Error(`Record with id ${id} not found`);
      }

      return result;
    });
  }

  async #updateRecordWithID(
    recordId: string,
    object: Partial<EditableData<Data>>,
    columns: SelectableColumn<Record>[] = ['*']
  ) {
    const fetchProps = await this.#getFetchProps();

    const record = transformObjectLinks(object);

    try {
      const response = await updateRecordWithID({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
        queryParams: { columns },
        body: record,
        ...fetchProps
      });

      const schemaTables = await this.#getSchemaTables();
      return initObject(this.#db, schemaTables, this.#table, response) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async createOrUpdate<K extends SelectableColumn<Record>>(
    object: EditableData<Data> & Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrUpdate(object: EditableData<Data> & Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    id: string,
    object: Omit<EditableData<Data>, 'id'>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrUpdate(
    id: string,
    object: Omit<EditableData<Data>, 'id'>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Data> & Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async createOrUpdate(
    objects: Array<EditableData<Data> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    a: string | EditableData<Data> | EditableData<Data>[],
    b?: EditableData<Data> | Omit<EditableData<Data>, 'id'> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('createOrUpdate', async () => {
      // Create or update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        if (a.length > 100) {
          // TODO: Implement bulk update when API has support for it
          console.warn('Bulk update operation is not optimized in the Xata API yet, this request might be slow');
        }

        const columns = isStringArray(b) ? b : (['*'] as K[]);
        return Promise.all(a.map((object) => this.createOrUpdate(object as any, columns)));
      }

      // Create or update one record with id as param
      if (isString(a) && isObject(b)) {
        const columns = isStringArray(c) ? c : undefined;
        return this.#upsertRecordWithID(a, b, columns);
      }

      // Create or update one record with id as property
      if (isObject(a) && isString(a.id)) {
        const columns = isStringArray(c) ? c : undefined;
        return this.#upsertRecordWithID(a.id, { ...a, id: undefined }, columns);
      }

      throw new Error('Invalid arguments for createOrUpdate method');
    });
  }

  async #upsertRecordWithID(
    recordId: string,
    object: Omit<EditableData<Data>, 'id'>,
    columns: SelectableColumn<Record>[] = ['*']
  ) {
    const fetchProps = await this.#getFetchProps();

    const response = await upsertRecordWithID({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
      queryParams: { columns },
      body: object,
      ...fetchProps
    });

    const schemaTables = await this.#getSchemaTables();
    return initObject(this.#db, schemaTables, this.#table, response) as any;
  }

  async delete<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async delete(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async delete<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async delete(id: string): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async delete<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async delete(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async delete<K extends SelectableColumn<Record>>(
    objects: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async delete(objects: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async delete<K extends SelectableColumn<Record>>(
    a: string | Identifiable | Array<string | Identifiable>,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>> | null>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>> | null>
    | null
  > {
    return this.#trace('delete', async () => {
      // Delete many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        if (a.length > 100) {
          // TODO: Implement bulk delete when API has support for it
          console.warn('Bulk delete operation is not optimized in the Xata API yet, this request might be slow');
        }

        return Promise.all(a.map((id) => this.delete(id as any, b as any)));
      }

      // Delete one record with id as param
      if (isString(a)) {
        return this.#deleteRecord(a, b);
      }

      // Delete one record with id as property
      if (isObject(a) && isString(a.id)) {
        return this.#deleteRecord(a.id, b);
      }

      throw new Error('Invalid arguments for delete method');
    });
  }

  async deleteOrThrow<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async deleteOrThrow(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    id: string,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async deleteOrThrow(id: string): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Data>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async deleteOrThrow(
    objects: Array<Partial<EditableData<Data>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: string[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async deleteOrThrow(objects: string[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    a: string | Identifiable | Array<string | Identifiable>,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('delete', async () => {
      throw new Error('Not implemented');
    });
  }

  async #deleteRecord(recordId: string, columns: SelectableColumn<Record>[] = ['*']) {
    const fetchProps = await this.#getFetchProps();

    try {
      const response = await deleteRecord({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table, recordId },
        queryParams: { columns },
        ...fetchProps
      });

      const schemaTables = await this.#getSchemaTables();
      return initObject(this.#db, schemaTables, this.#table, response) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async search(
    query: string,
    options: {
      fuzziness?: FuzzinessExpression;
      prefix?: PrefixExpression;
      highlight?: HighlightExpression;
      filter?: Filter<Record>;
      boosters?: Boosters<Record>[];
    } = {}
  ) {
    return this.#trace('search', async () => {
      const fetchProps = await this.#getFetchProps();

      const { records } = await searchTable({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
        body: {
          query,
          fuzziness: options.fuzziness,
          prefix: options.prefix,
          highlight: options.highlight,
          filter: options.filter as Schemas.FilterExpression,
          boosters: options.boosters as Schemas.BoosterExpression[]
        },
        ...fetchProps
      });

      const schemaTables = await this.#getSchemaTables();
      return records.map((item) => initObject(this.#db, schemaTables, this.#table, item)) as any;
    });
  }

  async query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>> {
    return this.#trace('query', async () => {
      const cacheQuery = await this.#getCacheQuery<Result>(query);
      if (cacheQuery) return new Page<Record, Result>(query, cacheQuery.meta, cacheQuery.records);

      const data = query.getQueryOptions();

      const body = {
        filter: Object.values(data.filter ?? {}).some(Boolean) ? data.filter : undefined,
        sort: data.sort !== undefined ? buildSortFilter(data.sort) : undefined,
        page: data.pagination,
        columns: data.columns
      };

      const fetchProps = await this.#getFetchProps();
      const { meta, records: objects } = await queryTable({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', tableName: this.#table },
        body,
        ...fetchProps
      });

      const schemaTables = await this.#getSchemaTables();
      const records = objects.map((record) => initObject<Result>(this.#db, schemaTables, this.#table, record));
      await this.#setCacheQuery(query, meta, records);

      return new Page<Record, Result>(query, meta, records);
    });
  }

  async #setCacheQuery(query: Query<Record, XataRecord>, meta: RecordsMetadata, records: XataRecord[]): Promise<void> {
    await this.#cache.set(`query_${this.#table}:${query.key()}`, { date: new Date(), meta, records });
  }

  async #getCacheQuery<T extends XataRecord>(
    query: Query<Record, XataRecord>
  ): Promise<{ meta: RecordsMetadata; records: T[] } | null> {
    const key = `query_${this.#table}:${query.key()}`;
    const result = await this.#cache.get<{ date: Date; meta: RecordsMetadata; records: T[] }>(key);
    if (!result) return null;

    const { cache: ttl = this.#cache.defaultQueryTTL } = query.getQueryOptions();
    if (ttl < 0) return null;

    const hasExpired = result.date.getTime() + ttl < Date.now();
    return hasExpired ? null : result;
  }

  async #getSchemaTables(): Promise<Schemas.Table[]> {
    if (this.#schemaTables) return this.#schemaTables;
    const fetchProps = await this.#getFetchProps();

    const { schema } = await getBranchDetails({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}' },
      ...fetchProps
    });

    this.#schemaTables = schema.tables;
    return schema.tables;
  }
}

const transformObjectLinks = (object: any) => {
  return Object.entries(object).reduce((acc, [key, value]) => {
    // Ignore internal properties
    if (key === 'xata') return acc;

    // Transform links to identifier
    return { ...acc, [key]: isIdentifiable(value) ? value.id : value };
  }, {});
};

export const initObject = <T>(
  db: Record<string, Repository<any>>,
  schemaTables: Schemas.Table[],
  table: string,
  object: Record<string, unknown>
) => {
  const result: Dictionary<unknown> = {};
  const { xata, ...rest } = object ?? {};
  Object.assign(result, rest);

  const { columns } = schemaTables.find(({ name }) => name === table) ?? {};
  if (!columns) console.error(`Table ${table} not found in schema`);

  for (const column of columns ?? []) {
    const value = result[column.name];

    switch (column.type) {
      case 'datetime': {
        const date = value !== undefined ? new Date(value as string) : undefined;

        if (date && isNaN(date.getTime())) {
          console.error(`Failed to parse date ${value} for field ${column.name}`);
        } else if (date) {
          result[column.name] = date;
        }

        break;
      }
      case 'link': {
        const linkTable = column.link?.table;

        if (!linkTable) {
          console.error(`Failed to parse link for field ${column.name}`);
        } else if (isObject(value)) {
          result[column.name] = initObject(db, schemaTables, linkTable, value);
        }

        break;
      }
      default:
        break;
    }
  }

  result.read = function (columns?: any) {
    return db[table].read(result['id'] as string, columns);
  };

  result.update = function (data: any, columns?: any) {
    return db[table].update(result['id'] as string, data, columns);
  };

  result.delete = function () {
    return db[table].delete(result['id'] as string);
  };

  result.getMetadata = function () {
    return xata;
  };

  for (const prop of ['read', 'update', 'delete', 'getMetadata']) {
    Object.defineProperty(result, prop, { enumerable: false });
  }

  Object.freeze(result);
  return result as T;
};

function getIds(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => getIds(item)).flat();
  }

  if (!isObject(value)) return [];

  const nestedIds = Object.values(value)
    .map((item) => getIds(item))
    .flat();

  return isString(value.id) ? [value.id, ...nestedIds] : nestedIds;
}

function isResponseWithRecords(value: any): value is { records: Schemas.XataRecord[] } {
  return isObject(value) && Array.isArray(value.records);
}

function extractId(value: any): string | undefined {
  if (isString(value)) return value;
  if (isObject(value) && isString(value.id)) return value.id;
  return undefined;
}
