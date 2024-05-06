import { SchemaPluginResult } from '.';
import {
  ApiExtraProps,
  Schemas,
  aggregateTable,
  askTableSession,
  branchTransaction,
  deleteRecord,
  getBranchDetails,
  getRecord,
  insertRecord,
  insertRecordWithID,
  queryTable,
  searchTable,
  summarizeTable,
  updateRecordWithID,
  upsertRecordWithID,
  vectorSearchTable
} from '../api';
import { fetchSSERequest } from '../api/fetcher';
import {
  FuzzinessExpression,
  HighlightExpression,
  PrefixExpression,
  SearchPageConfig,
  TransactionOperation
} from '../api/schemas';
import { XataPluginOptions } from '../plugins';
import { SearchXataRecord, TotalCount } from '../search';
import { Boosters } from '../search/boosters';
import { TargetColumn } from '../search/target';
import { SQLPluginFunction, SQLPluginResult, SQLQuery, SqlKyselyPlugin } from '../sql';
import { chunk, compact, isDefined, isNumber, isObject, isString, promiseMap } from '../util/lang';
import { Dictionary } from '../util/types';
import { generateUUID } from '../util/uuid';
import { VERSION } from '../version';
import { AggregationExpression, AggregationResult } from './aggregate';
import { AskOptions, AskResult } from './ask';
import { XataArrayFile, XataFile, parseInputFileEntry } from './files';
import { Filter, cleanFilter } from './filters';
import { parseJson, stringifyJson } from './json';
import { Page } from './pagination';
import { Query } from './query';
import { EditableData, Identifiable, Identifier, InputXataFile, XataRecord, isIdentifiable } from './record';
import {
  ColumnsByValue,
  SelectableColumn,
  SelectableColumnWithObjectNotation,
  SelectedPick,
  isValidSelectableColumns
} from './selection';
import { buildSortFilter } from './sorting';
import { SummarizeExpression } from './summarize';
import { AttributeDictionary, TraceAttributes, TraceFunction, defaultTrace } from './tracing';

const BULK_OPERATION_MAX_SIZE = 1000;

/**
 * Common interface for performing operations on a table.
 */
export abstract class Repository<Record extends XataRecord> extends Query<
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
    object: Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /*
   * Creates a single record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(
    object: Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates a single record in the table with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract create<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates a single record in the table with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(
    id: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order.
   */
  abstract create<K extends SelectableColumn<Record>>(
    objects: Array<Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records in order.
   */
  abstract create(
    objects: Array<Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read<K extends SelectableColumn<Record>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns> | null>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read<K extends SelectableColumn<Record>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

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
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<Record>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;

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
    object: Partial<EditableData<Record>> & Identifiable,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update(
    object: Partial<EditableData<Record>> & Identifiable,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order (if a record could not be found null is returned).
   */
  abstract update<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @returns Array of the persisted records in order (if a record could not be found null is returned).
   */
  abstract update(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<Record>>(
    object: Partial<EditableData<Record>> & Identifiable,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow(
    object: Partial<EditableData<Record>> & Identifiable,
    options?: { ifVersion?: number }
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
    id: Identifier,
    object: Partial<EditableData<Record>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order.
   * @throws If one or more records could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @returns Array of the persisted records in order.
   * @throws If one or more records could not be found.
   */
  abstract updateOrThrow(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrUpdate<K extends SelectableColumn<Record>>(
    object: Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(
    object: Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrUpdate<K extends SelectableColumn<Record>>(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records.
   */
  abstract createOrUpdate<K extends SelectableColumn<Record>>(
    objects: Array<Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createOrUpdate(
    objects: Array<Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrReplace<K extends SelectableColumn<Record>>(
    object: Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @returns The full persisted record.
   */
  abstract createOrReplace(
    object: Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrReplace<K extends SelectableColumn<Record>>(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract createOrReplace(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records.
   */
  abstract createOrReplace<K extends SelectableColumn<Record>>(
    objects: Array<Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createOrReplace(
    objects: Array<Omit<EditableData<Record>, 'xata_id'> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete<K extends SelectableColumn<Record>>(
    object: Identifiable & Partial<EditableData<Record>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete(
    object: Identifiable & Partial<EditableData<Record>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete<K extends SelectableColumn<Record>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete<K extends SelectableColumn<Record>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;

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
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @returns Array of the deleted records in order.
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;

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
      page?: SearchPageConfig;
      target?: TargetColumn<Record>[];
    }
  ): Promise<{ records: SearchXataRecord<SelectedPick<Record, ['*']>>[] } & TotalCount>;

  /**
   * Search for vectors in the table.
   * @param column The column to search for.
   * @param query The vector to search for similarities. Must have the same dimension as the vector column used.
   * @param options The options to search with (like: spaceFunction)
   */
  abstract vectorSearch<F extends ColumnsByValue<Record, number[]>>(
    column: F,
    query: number[],
    options?: {
      /**
       * The function used to measure the distance between two points. Can be one of:
       * `cosineSimilarity`, `l1`, `l2`. The default is `cosineSimilarity`.
       *
       * @default cosineSimilarity
       */
      similarityFunction?: string;
      /**
       * Number of results to return.
       *
       * @default 10
       * @maximum 100
       * @minimum 1
       */
      size?: number;
      filter?: Filter<Record>;
    }
  ): Promise<{ records: SearchXataRecord<SelectedPick<Record, ['*']>>[] } & TotalCount>;

  /**
   * Aggregates records in the table.
   * @param expression The aggregations to perform.
   * @param filter The filter to apply to the queried records.
   * @returns The requested aggregations.
   */
  abstract aggregate<Expression extends Dictionary<AggregationExpression<Record>>>(
    expression?: Expression,
    filter?: Filter<Record>
  ): Promise<AggregationResult<Record, Expression>>;

  /**
   * Experimental: Ask the database to perform a natural language question.
   */
  abstract ask(question: string, options?: AskOptions<Record>): Promise<AskResult>;

  /**
   * Experimental: Ask the database to perform a natural language question.
   */
  abstract ask(question: string, options: AskOptions<Record>): Promise<AskResult>;

  /**
   * Experimental: Ask the database to perform a natural language question.
   */
  abstract ask(question: string, options: AskOptions<Record> & { onMessage: (message: AskResult) => void }): void;

  abstract query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>>;
}

export class KyselyRepository<Record extends XataRecord>
  extends Query<Record, SelectedPick<Record, ['*']>>
  implements Repository<Record>
{
  #table: string;
  #getFetchProps: () => ApiExtraProps;
  #db: SQLPluginFunction;
  #schemaTables?: Schemas.Table[];
  #trace: TraceFunction;

  constructor(options: {
    table: string;
    db: SQLPluginFunction;
    pluginOptions: XataPluginOptions;
    schemaTables?: Schemas.Table[];
  }) {
    super(
      null,
      { name: options.table, schema: options.schemaTables?.find((table) => table.name === options.table) },
      {}
    );

    this.#table = options.table;
    this.#db = new SqlKyselyPlugin().build(options.pluginOptions);
    // pass plugin options here.
    this.#schemaTables = options.schemaTables;
    this.#getFetchProps = () => ({ ...options.pluginOptions, sessionID: generateUUID() });

    const trace = options.pluginOptions.trace ?? defaultTrace;
    this.#trace = async <T>(
      name: string,
      fn: (options: { setAttributes: (attrs: AttributeDictionary) => void }) => T,
      options: AttributeDictionary = {}
    ) => {
      return trace<T>(name, fn, {
        ...options,
        [TraceAttributes.TABLE]: this.#table,
        [TraceAttributes.KIND]: 'sdk-operation',
        [TraceAttributes.VERSION]: VERSION
      });
    };
  }

  async create<K extends SelectableColumn<Record>>(
    object: EditableData<Record> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async create(
    object: EditableData<Record> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async create<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: EditableData<Record>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async create(
    id: Identifier,
    object: EditableData<Record>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async create<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Record> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async create(
    objects: Array<EditableData<Record> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async create<K extends SelectableColumn<Record>>(
    a:
      | Identifier
      | (EditableData<Record> & Partial<Identifiable>)
      | Array<EditableData<Record> & Partial<Identifiable>>,
    b?: EditableData<Record> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, K[]>>
    | Readonly<SelectedPick<Record, K[]>>[]
    | Readonly<SelectedPick<Record, ['*']>>
    | Readonly<SelectedPick<Record, ['*']>>[]
  > {
    return this.#trace('create', async () => {
      console.log('..................');
      const ifVersion = parseIfVersion(b, c, d);

      // Create many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = await this.#insertRecords(a, { ifVersion, createOnly: true });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(ids as string[], columns);
        return result;
      }

      // Create one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a, b as EditableData<Record>, columns, { createOnly: true, ifVersion });
      }

      // Create one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        if (a.xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(b) ? b : undefined;
        return await this.#insertRecordWithId(a.xata_id, { ...a, xata_id: undefined }, columns, {
          createOnly: true,
          ifVersion
        });
      }

      // Create one record without id
      if (isObject(a)) {
        const columns = isValidSelectableColumns(b) ? b : undefined;
        return this.#insertRecordWithoutId(a, columns);
      }

      throw new Error('Invalid arguments for create method');
    });
  }

  async #insertRecordWithoutId(object: EditableData<Record>, columns: SelectableColumn<Record>[] = ['*']) {
    const record = await this.#transformObjectToApi(object);
    const statement = `INSERT INTO ${this.#table} (${Object.keys(record).join(', ')}) VALUES (${Object.values(
      record
    ).join(', ')});`;
    console.log('rec', statement);

    const response = await this.#db({
      statement,
      params: []
    });

    console.log('response.....', response);

    const schemaTables = await this.#getSchemaTables();
    return initObjectKysely(this.#db, schemaTables, this.#table, response, columns) as any;
  }

  async #insertRecordWithId(
    recordId: Identifier,
    object: EditableData<Record>,
    columns: SelectableColumn<Record>[] = ['*'],
    { createOnly, ifVersion }: { createOnly: boolean; ifVersion?: number }
  ) {
    if (!recordId) return null;

    const record = await this.#transformObjectToApi(object);

    const response = await this.#db({
      statement: `INSERT INTO ${this.#table} (xata_id, ${Object.keys(record).join(
        ', '
      )}) VALUES ('${recordId}', ${Object.values(record).join(', ')});`,
      params: []
    });

    const schemaTables = await this.#getSchemaTables();
    return initObjectKysely(this.#db, schemaTables, this.#table, response, columns) as any;
  }

  async #insertRecords(
    objects: EditableData<Record>[],
    { createOnly, ifVersion }: { createOnly: boolean; ifVersion?: number }
  ) {
    const operations = await promiseMap(objects, async (object) => {
      const record = await this.#transformObjectToApi(object);
      return { insert: { table: this.#table, record, createOnly, ifVersion } };
    });

    const chunkedOperations: TransactionOperation[][] = chunk(operations, BULK_OPERATION_MAX_SIZE);

    const ids = [];

    for (const operations of chunkedOperations) {
      const { records } = await this.#db({
        statement: `BEGIN ${operations} COMMIT;`
      });

      for (const result of records) {
        ids.push((result as any)?.xata_id);
      }
    }

    return ids;
  }

  async read<K extends SelectableColumn<Record>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns> | null>>;
  async read(id: string): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;
  async read<K extends SelectableColumn<Record>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async read(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
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
    a: Identifier | ReadonlyArray<Identifier> | Identifiable | Identifiable[],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>> | null>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>> | null>
    | null
  > {
    return this.#trace('read', async () => {
      const columns = isValidSelectableColumns(b) ? b : ['*' as const];

      // Read many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = a.map((item) => extractId(item));

        const finalObjects = await this.getAll({ filter: { xata_id: { $any: compact(ids) } }, columns });

        // Maintain order of objects
        const dictionary = finalObjects.reduce((acc, object) => {
          acc[object.xata_id] = object;
          return acc;
        }, {} as Dictionary<any>);

        return ids.map((id) => dictionary[id ?? ''] ?? null);
      }

      // Read one record
      const id = extractId(a);
      if (id) {
        try {
          const response = await getRecord({
            pathParams: {
              workspace: '{workspaceId}',
              dbBranchName: '{dbBranch}',
              region: '{region}',
              tableName: this.#table,
              recordId: id
            },
            queryParams: { columns },
            ...this.#getFetchProps()
          });

          const schemaTables = await this.#getSchemaTables();
          return initObjectKysely<Record>(
            this.#db,
            schemaTables,
            this.#table,
            response,
            columns as SelectableColumn<Record>[]
          ) as any;
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
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async readOrThrow(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<Record>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async readOrThrow(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
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
    a: Identifier | ReadonlyArray<Identifier> | Identifiable | Identifiable[],
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
    object: Partial<EditableData<Record>> & Identifiable,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async update(
    object: Partial<EditableData<Record>> & Identifiable,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async update<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async update(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async update<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async update(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async update<K extends SelectableColumn<Record>>(
    a:
      | Identifier
      | (Partial<EditableData<Record>> & Identifiable)
      | Array<Partial<EditableData<Record>> & Identifiable>,
    b?: Partial<EditableData<Record>> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>> | null>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>> | null>
    | null
  > {
    return this.#trace('update', async () => {
      const ifVersion = parseIfVersion(b, c, d);

      // Update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        // TODO: Transaction API fails fast if one of the records is not found
        const existing = await this.read(a, ['xata_id'] as SelectableColumn<Record>[]);
        const updates = a.filter((_item, index) => existing[index] !== null);

        await this.#updateRecords(updates as Array<Partial<EditableData<Record>> & Identifiable>, {
          ifVersion,
          upsert: false
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a, columns);
        return result;
      }

      try {
        // Update one record with id as param
        if (isString(a) && isObject(b)) {
          const columns = isValidSelectableColumns(c) ? c : undefined;
          return await this.#updateRecordWithID(a, b as EditableData<Record>, columns, { ifVersion });
        }

        // Update one record with id as property
        if (isObject(a) && isString(a.xata_id)) {
          const columns = isValidSelectableColumns(b) ? b : undefined;
          return await this.#updateRecordWithID(a.xata_id, { ...a, xata_id: undefined }, columns, { ifVersion });
        }
      } catch (error: any) {
        if (error.status === 422) return null;
        throw error;
      }

      throw new Error('Invalid arguments for update method');
    });
  }

  async updateOrThrow<K extends SelectableColumn<Record>>(
    object: Partial<EditableData<Record>> & Identifiable,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async updateOrThrow(
    object: Partial<EditableData<Record>> & Identifiable,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async updateOrThrow(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async updateOrThrow(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    a:
      | Identifier
      | (Partial<EditableData<Record>> & Identifiable)
      | Array<Partial<EditableData<Record>> & Identifiable>,
    b?: Partial<EditableData<Record>> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('updateOrThrow', async () => {
      const result = await this.update(a as any, b as any, c as any, d as any);

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
    recordId: Identifier,
    object: Partial<EditableData<Record>>,
    columns: SelectableColumn<Record>[] = ['*'],
    { ifVersion }: { ifVersion?: number }
  ) {
    if (!recordId) return null;

    // Ensure id is not present in the update payload
    const { xata_id: _id, ...record } = await this.#transformObjectToApi(object);

    try {
      const response = await updateRecordWithID({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table,
          recordId
        },
        queryParams: { columns, ifVersion },
        body: record,
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();
      return initObjectKysely(this.#db, schemaTables, this.#table, response, columns) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async #updateRecords(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    { ifVersion, upsert }: { ifVersion?: number; upsert: boolean }
  ) {
    const operations = await promiseMap(objects, async ({ xata_id, ...object }) => {
      const fields = await this.#transformObjectToApi(object);
      return { update: { table: this.#table, id: xata_id, ifVersion, upsert, fields } };
    });

    const chunkedOperations: TransactionOperation[][] = chunk(operations, BULK_OPERATION_MAX_SIZE);

    const ids = [];

    for (const operations of chunkedOperations) {
      const { results } = await branchTransaction({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}'
        },
        body: { operations },
        ...this.#getFetchProps()
      });

      for (const result of results) {
        if (result.operation === 'update') {
          ids.push(result.id);
        } else {
          ids.push(null);
        }
      }
    }

    return ids;
  }

  async createOrUpdate<K extends SelectableColumn<Record>>(
    object: EditableData<Record> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrUpdate(
    object: EditableData<Record> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrUpdate(
    id: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Record> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async createOrUpdate(
    objects: Array<EditableData<Record> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    a: Identifier | EditableData<Record> | EditableData<Record>[],
    b?: EditableData<Record> | Omit<EditableData<Record>, 'xata_id'> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('createOrUpdate', async () => {
      const ifVersion = parseIfVersion(b, c, d);

      // Create or update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        await this.#updateRecords(a as Array<Partial<EditableData<Record>> & Identifiable>, {
          ifVersion,
          upsert: true
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a as any[], columns);
        return result;
      }

      // Create or update one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#upsertRecordWithID(a, b as EditableData<Record>, columns, { ifVersion });
      }

      // Create or update one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        if (a.xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#upsertRecordWithID(a.xata_id, { ...a, xata_id: undefined }, columns, { ifVersion });
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as EditableData<Record>, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined(a.xata_id)) {
        return await this.create(a as EditableData<Record>, b as K[]);
      }

      throw new Error('Invalid arguments for createOrUpdate method');
    });
  }

  async #upsertRecordWithID(
    recordId: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: SelectableColumn<Record>[] = ['*'],
    { ifVersion }: { ifVersion?: number }
  ) {
    if (!recordId) return null;

    const response = await upsertRecordWithID({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        region: '{region}',
        tableName: this.#table,
        recordId
      },
      queryParams: { columns, ifVersion },
      body: object as Schemas.DataInputRecord,
      ...this.#getFetchProps()
    });

    const schemaTables = await this.#getSchemaTables();
    return initObjectKysely(this.#db, schemaTables, this.#table, response, columns) as any;
  }

  async createOrReplace<K extends SelectableColumn<Record>>(
    object: EditableData<Record> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrReplace(
    object: EditableData<Record> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<Record>>(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrReplace(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Record> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async createOrReplace(
    objects: Array<EditableData<Record> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async createOrReplace<K extends SelectableColumn<Record>>(
    a: Identifier | EditableData<Record> | EditableData<Record>[] | undefined,
    b?: EditableData<Record> | Omit<EditableData<Record>, 'xata_id'> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('createOrReplace', async () => {
      const ifVersion = parseIfVersion(b, c, d);

      // Create or replace many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = await this.#insertRecords(a, { ifVersion, createOnly: false });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(ids as string[], columns);
        return result;
      }

      // Create or replace one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a, b as EditableData<Record>, columns, { createOnly: false, ifVersion });
      }

      // Create or replace one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        if (a.xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a.xata_id, { ...a, xata_id: undefined }, columns, {
          createOnly: false,
          ifVersion
        });
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as EditableData<Record>, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined(a.xata_id)) {
        return await this.create(a as EditableData<Record>, b as K[]);
      }

      throw new Error('Invalid arguments for createOrReplace method');
    });
  }

  async delete<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async delete(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async delete<K extends SelectableColumn<Record>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async delete(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async delete<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async delete(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async delete<K extends SelectableColumn<Record>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async delete(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async delete<K extends SelectableColumn<Record>>(
    a: Identifier | Identifiable | Array<Identifier | Identifiable>,
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

        const ids = a.map((o) => {
          if (isString(o)) return o;
          if (isString(o.xata_id)) return o.xata_id;
          throw new Error('Invalid arguments for delete method');
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a as any, columns);

        await this.#deleteRecords(ids);

        return result;
      }

      // Delete one record with id as param
      if (isString(a)) {
        return this.#deleteRecord(a, b);
      }

      // Delete one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        return this.#deleteRecord(a.xata_id, b);
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
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async deleteOrThrow(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async deleteOrThrow(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async deleteOrThrow(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    a: Identifier | Identifiable | Array<Identifier | Identifiable>,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('deleteOrThrow', async () => {
      const result = await this.delete(a as any, b as any);

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
      } else if (result === null) {
        const id = extractId(a) ?? 'unknown';
        throw new Error(`Record with id ${id} not found`);
      }

      return result;
    });
  }

  async #deleteRecord(recordId: Identifier, columns: SelectableColumn<Record>[] = ['*']) {
    if (!recordId) return null;

    try {
      const response = await deleteRecord({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table,
          recordId
        },
        queryParams: { columns },
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();
      return initObjectKysely(this.#db, schemaTables, this.#table, response, columns) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async #deleteRecords(recordIds: Identifier[]) {
    const chunkedOperations: TransactionOperation[][] = chunk(
      compact(recordIds).map((id) => ({ delete: { table: this.#table, id } })),
      BULK_OPERATION_MAX_SIZE
    );

    for (const operations of chunkedOperations) {
      await branchTransaction({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}'
        },
        body: { operations },
        ...this.#getFetchProps()
      });
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
      page?: SearchPageConfig;
      target?: TargetColumn<Record>[];
    } = {}
  ) {
    return this.#trace('search', async () => {
      const { records, totalCount } = await searchTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          query,
          fuzziness: options.fuzziness,
          prefix: options.prefix,
          highlight: options.highlight,
          filter: options.filter as Schemas.FilterExpression,
          boosters: options.boosters as Schemas.BoosterExpression[],
          page: options.page,
          target: options.target as Schemas.TargetExpression
        },
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) => initObjectKysely(this.#db, schemaTables, this.#table, item, ['*'])) as any,
        totalCount
      };
    });
  }

  async vectorSearch<F extends ColumnsByValue<Record, number[]>>(
    column: F,
    query: number[],
    options?:
      | {
          similarityFunction?: string | undefined;
          size?: number | undefined;
          filter?: Filter<Record> | undefined;
        }
      | undefined
  ): Promise<{ records: SearchXataRecord<SelectedPick<Record, ['*']>>[] } & TotalCount> {
    return this.#trace('vectorSearch', async () => {
      const { records, totalCount } = await vectorSearchTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          column,
          queryVector: query,
          similarityFunction: options?.similarityFunction,
          size: options?.size,
          filter: options?.filter as Schemas.FilterExpression
        },
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) => initObjectKysely(this.#db, schemaTables, this.#table, item, ['*'])),
        totalCount
      } as any;
    });
  }

  async aggregate<Expression extends Dictionary<AggregationExpression<Record>>>(
    aggs?: Expression,
    filter?: Filter<Record>
  ) {
    return this.#trace('aggregate', async () => {
      const result = await aggregateTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: { aggs, filter: filter as Schemas.FilterExpression },
        ...this.#getFetchProps()
      });

      return result as any;
    });
  }

  async query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>> {
    return this.#trace('query', async () => {
      const data = query.getQueryOptions();

      const { meta, records: objects } = await queryTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          filter: cleanFilter(data.filter),
          sort: data.sort !== undefined ? buildSortFilter(data.sort) : undefined,
          page: data.pagination,
          columns: data.columns ?? ['*'],
          consistency: data.consistency
        },
        fetchOptions: data.fetchOptions,
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();
      const records = objects.map((record) =>
        initObjectKysely<Result>(
          this.#db,
          schemaTables,
          this.#table,
          record,
          (data.columns as SelectableColumn<Result>[]) ?? ['*']
        )
      );

      return new Page<Record, Result>(query, meta, records);
    });
  }

  async summarizeTable<Result extends XataRecord>(
    query: Query<Record, Result>,
    summaries?: Dictionary<SummarizeExpression<Record>>,
    summariesFilter?: Schemas.FilterExpression
  ) {
    return this.#trace('summarize', async () => {
      const data = query.getQueryOptions();

      const result = await summarizeTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          filter: cleanFilter(data.filter),
          sort: data.sort !== undefined ? buildSortFilter(data.sort) : undefined,
          columns: data.columns as SelectableColumn<Record>[],
          consistency: data.consistency,
          page: data.pagination?.size !== undefined ? { size: data.pagination?.size } : undefined,
          summaries,
          summariesFilter
        },
        ...this.#getFetchProps()
      });
      const schemaTables = await this.#getSchemaTables();
      return {
        ...result,
        summaries: result.summaries.map((summary) =>
          initObjectKysely(this.#db, schemaTables, this.#table, summary, data.columns ?? [])
        )
      };
    });
  }

  ask(question: string, options?: AskOptions<Record> & { onMessage?: (message: AskResult) => void }): any {
    // Ask with session uses message, ask without session uses question param
    const questionParam = options?.sessionId ? { message: question } : { question };
    const params = {
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        region: '{region}',
        tableName: this.#table,
        sessionId: options?.sessionId
      },
      body: {
        ...questionParam,
        rules: options?.rules,
        searchType: options?.searchType,
        search: options?.searchType === 'keyword' ? options?.search : undefined,
        vectorSearch: options?.searchType === 'vector' ? options?.vectorSearch : undefined
      },
      ...this.#getFetchProps()
    };

    if (options?.onMessage) {
      fetchSSERequest({
        endpoint: 'dataPlane',
        url: '/db/{dbBranchName}/tables/{tableName}/ask/{sessionId}',
        method: 'POST',
        onMessage: (message: { text: string; records: string[] }) => {
          options.onMessage?.({ answer: message.text, records: message.records });
        },
        ...params
      });
    } else {
      return askTableSession(params as any);
    }
  }

  async #getSchemaTables(): Promise<Schemas.Table[]> {
    if (this.#schemaTables) return this.#schemaTables;

    const { schema } = await getBranchDetails({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
      ...this.#getFetchProps()
    });

    this.#schemaTables = schema.tables;
    return schema.tables;
  }

  async #transformObjectToApi(object: any): Promise<Schemas.DataInputRecord> {
    const schemaTables = await this.#getSchemaTables();
    const schema = schemaTables.find((table) => table.name === this.#table);
    if (!schema) throw new Error(`Table ${this.#table} not found in schema`);

    const result: Dictionary<any> = {};

    for (const [key, value] of Object.entries(object)) {
      // Ignore internal properties
      if (['xata_version', 'xata_createdat', 'xata_updatedat'].includes(key)) continue;

      const type = schema.columns.find((column) => column.name === key)?.type;

      switch (type) {
        case 'link': {
          result[key] = isIdentifiable(value) ? value.xata_id : value;
          break;
        }
        case 'datetime': {
          result[key] = value instanceof Date ? value.toISOString() : value;
          break;
        }
        case `file`:
          result[key] = await parseInputFileEntry(value as InputXataFile);
          break;
        case 'file[]':
          result[key] = await promiseMap(value as InputXataFile[], (item) => parseInputFileEntry(item));
          break;
        case 'json':
          result[key] = stringifyJson(value as any);
          break;
        default:
          result[key] = value;
      }
    }

    return result;
  }
}

export class RestRepository<Record extends XataRecord>
  extends Query<Record, SelectedPick<Record, ['*']>>
  implements Repository<Record>
{
  #table: string;
  #getFetchProps: () => ApiExtraProps;
  #db: SchemaPluginResult<any>;
  #schemaTables?: Schemas.Table[];
  #trace: TraceFunction;

  constructor(options: {
    table: string;
    db: SchemaPluginResult<any>;
    pluginOptions: XataPluginOptions;
    schemaTables?: Schemas.Table[];
  }) {
    super(
      null,
      { name: options.table, schema: options.schemaTables?.find((table) => table.name === options.table) },
      {}
    );

    this.#table = options.table;
    this.#db = options.db;
    this.#schemaTables = options.schemaTables;
    this.#getFetchProps = () => ({ ...options.pluginOptions, sessionID: generateUUID() });

    const trace = options.pluginOptions.trace ?? defaultTrace;
    this.#trace = async <T>(
      name: string,
      fn: (options: { setAttributes: (attrs: AttributeDictionary) => void }) => T,
      options: AttributeDictionary = {}
    ) => {
      return trace<T>(name, fn, {
        ...options,
        [TraceAttributes.TABLE]: this.#table,
        [TraceAttributes.KIND]: 'sdk-operation',
        [TraceAttributes.VERSION]: VERSION
      });
    };
  }

  async create<K extends SelectableColumn<Record>>(
    object: EditableData<Record> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async create(
    object: EditableData<Record> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async create<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: EditableData<Record>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async create(
    id: Identifier,
    object: EditableData<Record>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async create<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Record> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async create(
    objects: Array<EditableData<Record> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async create<K extends SelectableColumn<Record>>(
    a:
      | Identifier
      | (EditableData<Record> & Partial<Identifiable>)
      | Array<EditableData<Record> & Partial<Identifiable>>,
    b?: EditableData<Record> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, K[]>>
    | Readonly<SelectedPick<Record, K[]>>[]
    | Readonly<SelectedPick<Record, ['*']>>
    | Readonly<SelectedPick<Record, ['*']>>[]
  > {
    return this.#trace('create', async () => {
      const ifVersion = parseIfVersion(b, c, d);

      // Create many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = await this.#insertRecords(a, { ifVersion, createOnly: true });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(ids as string[], columns);
        return result;
      }

      // Create one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a, b as EditableData<Record>, columns, { createOnly: true, ifVersion });
      }

      // Create one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        if (a.xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(b) ? b : undefined;
        return await this.#insertRecordWithId(a.xata_id, { ...a, xata_id: undefined }, columns, {
          createOnly: true,
          ifVersion
        });
      }

      // Create one record without id
      if (isObject(a)) {
        const columns = isValidSelectableColumns(b) ? b : undefined;
        return this.#insertRecordWithoutId(a, columns);
      }

      throw new Error('Invalid arguments for create method');
    });
  }

  async #insertRecordWithoutId(object: EditableData<Record>, columns: SelectableColumn<Record>[] = ['*']) {
    const record = await this.#transformObjectToApi(object);

    const response = await insertRecord({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        region: '{region}',
        tableName: this.#table
      },
      queryParams: { columns },
      body: record,
      ...this.#getFetchProps()
    });

    const schemaTables = await this.#getSchemaTables();
    return initObject(this.#db, schemaTables, this.#table, response, columns) as any;
  }

  async #insertRecordWithId(
    recordId: Identifier,
    object: EditableData<Record>,
    columns: SelectableColumn<Record>[] = ['*'],
    { createOnly, ifVersion }: { createOnly: boolean; ifVersion?: number }
  ) {
    if (!recordId) return null;

    const record = await this.#transformObjectToApi(object);

    const response = await insertRecordWithID({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        region: '{region}',
        tableName: this.#table,
        recordId
      },
      body: record,
      queryParams: { createOnly, columns, ifVersion },
      ...this.#getFetchProps()
    });

    const schemaTables = await this.#getSchemaTables();
    return initObject(this.#db, schemaTables, this.#table, response, columns) as any;
  }

  async #insertRecords(
    objects: EditableData<Record>[],
    { createOnly, ifVersion }: { createOnly: boolean; ifVersion?: number }
  ) {
    const operations = await promiseMap(objects, async (object) => {
      const record = await this.#transformObjectToApi(object);
      return { insert: { table: this.#table, record, createOnly, ifVersion } };
    });

    const chunkedOperations: TransactionOperation[][] = chunk(operations, BULK_OPERATION_MAX_SIZE);

    const ids = [];

    for (const operations of chunkedOperations) {
      const { results } = await branchTransaction({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}'
        },
        body: { operations },
        ...this.#getFetchProps()
      });

      for (const result of results) {
        if (result.operation === 'insert') {
          ids.push(result.id);
        } else {
          ids.push(null);
        }
      }
    }

    return ids;
  }

  async read<K extends SelectableColumn<Record>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns> | null>>;
  async read(id: string): Promise<Readonly<SelectedPick<Record, ['*']> | null>>;
  async read<K extends SelectableColumn<Record>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async read(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
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
    a: Identifier | ReadonlyArray<Identifier> | Identifiable | Identifiable[],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>> | null>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>> | null>
    | null
  > {
    return this.#trace('read', async () => {
      const columns = isValidSelectableColumns(b) ? b : ['*' as const];

      // Read many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = a.map((item) => extractId(item));

        const finalObjects = await this.getAll({ filter: { xata_id: { $any: compact(ids) } }, columns });

        // Maintain order of objects
        const dictionary = finalObjects.reduce((acc, object) => {
          acc[object.xata_id] = object;
          return acc;
        }, {} as Dictionary<any>);

        return ids.map((id) => dictionary[id ?? ''] ?? null);
      }

      // Read one record
      const id = extractId(a);
      if (id) {
        try {
          const response = await getRecord({
            pathParams: {
              workspace: '{workspaceId}',
              dbBranchName: '{dbBranch}',
              region: '{region}',
              tableName: this.#table,
              recordId: id
            },
            queryParams: { columns },
            ...this.#getFetchProps()
          });

          const schemaTables = await this.#getSchemaTables();
          return initObject<Record>(
            this.#db,
            schemaTables,
            this.#table,
            response,
            columns as SelectableColumn<Record>[]
          ) as any;
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
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async readOrThrow(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<Record>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async readOrThrow(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
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
    a: Identifier | ReadonlyArray<Identifier> | Identifiable | Identifiable[],
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
    object: Partial<EditableData<Record>> & Identifiable,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async update(
    object: Partial<EditableData<Record>> & Identifiable,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async update<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async update(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async update<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async update(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async update<K extends SelectableColumn<Record>>(
    a:
      | Identifier
      | (Partial<EditableData<Record>> & Identifiable)
      | Array<Partial<EditableData<Record>> & Identifiable>,
    b?: Partial<EditableData<Record>> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>> | null>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>> | null>
    | null
  > {
    return this.#trace('update', async () => {
      const ifVersion = parseIfVersion(b, c, d);

      // Update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        // TODO: Transaction API fails fast if one of the records is not found
        const existing = await this.read(a, ['xata_id'] as SelectableColumn<Record>[]);
        const updates = a.filter((_item, index) => existing[index] !== null);

        await this.#updateRecords(updates as Array<Partial<EditableData<Record>> & Identifiable>, {
          ifVersion,
          upsert: false
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a, columns);
        return result;
      }

      try {
        // Update one record with id as param
        if (isString(a) && isObject(b)) {
          const columns = isValidSelectableColumns(c) ? c : undefined;
          return await this.#updateRecordWithID(a, b as EditableData<Record>, columns, { ifVersion });
        }

        // Update one record with id as property
        if (isObject(a) && isString(a.xata_id)) {
          const columns = isValidSelectableColumns(b) ? b : undefined;
          return await this.#updateRecordWithID(a.xata_id, { ...a, xata_id: undefined }, columns, { ifVersion });
        }
      } catch (error: any) {
        if (error.status === 422) return null;
        throw error;
      }

      throw new Error('Invalid arguments for update method');
    });
  }

  async updateOrThrow<K extends SelectableColumn<Record>>(
    object: Partial<EditableData<Record>> & Identifiable,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async updateOrThrow(
    object: Partial<EditableData<Record>> & Identifiable,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async updateOrThrow(
    id: Identifier,
    object: Partial<EditableData<Record>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async updateOrThrow(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async updateOrThrow<K extends SelectableColumn<Record>>(
    a:
      | Identifier
      | (Partial<EditableData<Record>> & Identifiable)
      | Array<Partial<EditableData<Record>> & Identifiable>,
    b?: Partial<EditableData<Record>> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('updateOrThrow', async () => {
      const result = await this.update(a as any, b as any, c as any, d as any);

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
    recordId: Identifier,
    object: Partial<EditableData<Record>>,
    columns: SelectableColumn<Record>[] = ['*'],
    { ifVersion }: { ifVersion?: number }
  ) {
    if (!recordId) return null;

    // Ensure id is not present in the update payload
    const { xata_id: _id, ...record } = await this.#transformObjectToApi(object);

    try {
      const response = await updateRecordWithID({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table,
          recordId
        },
        queryParams: { columns, ifVersion },
        body: record,
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();
      return initObject(this.#db, schemaTables, this.#table, response, columns) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async #updateRecords(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    { ifVersion, upsert }: { ifVersion?: number; upsert: boolean }
  ) {
    const operations = await promiseMap(objects, async ({ xata_id, ...object }) => {
      const fields = await this.#transformObjectToApi(object);
      return { update: { table: this.#table, id: xata_id, ifVersion, upsert, fields } };
    });

    const chunkedOperations: TransactionOperation[][] = chunk(operations, BULK_OPERATION_MAX_SIZE);

    const ids = [];

    for (const operations of chunkedOperations) {
      const { results } = await branchTransaction({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}'
        },
        body: { operations },
        ...this.#getFetchProps()
      });

      for (const result of results) {
        if (result.operation === 'update') {
          ids.push(result.id);
        } else {
          ids.push(null);
        }
      }
    }

    return ids;
  }

  async createOrUpdate<K extends SelectableColumn<Record>>(
    object: EditableData<Record> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrUpdate(
    object: EditableData<Record> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    id: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrUpdate(
    id: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Record> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async createOrUpdate(
    objects: Array<EditableData<Record> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async createOrUpdate<K extends SelectableColumn<Record>>(
    a: Identifier | EditableData<Record> | EditableData<Record>[],
    b?: EditableData<Record> | Omit<EditableData<Record>, 'xata_id'> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('createOrUpdate', async () => {
      const ifVersion = parseIfVersion(b, c, d);

      // Create or update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        await this.#updateRecords(a as Array<Partial<EditableData<Record>> & Identifiable>, {
          ifVersion,
          upsert: true
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a as any[], columns);
        return result;
      }

      // Create or update one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#upsertRecordWithID(a, b as EditableData<Record>, columns, { ifVersion });
      }

      // Create or update one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        if (a.xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#upsertRecordWithID(a.xata_id, { ...a, xata_id: undefined }, columns, { ifVersion });
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as EditableData<Record>, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined(a.xata_id)) {
        return await this.create(a as EditableData<Record>, b as K[]);
      }

      throw new Error('Invalid arguments for createOrUpdate method');
    });
  }

  async #upsertRecordWithID(
    recordId: Identifier,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: SelectableColumn<Record>[] = ['*'],
    { ifVersion }: { ifVersion?: number }
  ) {
    if (!recordId) return null;

    const response = await upsertRecordWithID({
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        region: '{region}',
        tableName: this.#table,
        recordId
      },
      queryParams: { columns, ifVersion },
      body: object as Schemas.DataInputRecord,
      ...this.#getFetchProps()
    });

    const schemaTables = await this.#getSchemaTables();
    return initObject(this.#db, schemaTables, this.#table, response, columns) as any;
  }

  async createOrReplace<K extends SelectableColumn<Record>>(
    object: EditableData<Record> & Partial<Identifiable>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrReplace(
    object: EditableData<Record> & Partial<Identifiable>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<Record>>(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async createOrReplace(
    id: Identifier | undefined,
    object: Omit<EditableData<Record>, 'xata_id'>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<Record>>(
    objects: Array<EditableData<Record> & Partial<Identifiable>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>[]>;
  async createOrReplace(
    objects: Array<EditableData<Record> & Partial<Identifiable>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>[]>;
  async createOrReplace<K extends SelectableColumn<Record>>(
    a: Identifier | EditableData<Record> | EditableData<Record>[] | undefined,
    b?: EditableData<Record> | Omit<EditableData<Record>, 'xata_id'> | K[] | { ifVersion?: number },
    c?: K[] | { ifVersion?: number },
    d?: { ifVersion?: number }
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('createOrReplace', async () => {
      const ifVersion = parseIfVersion(b, c, d);

      // Create or replace many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = await this.#insertRecords(a, { ifVersion, createOnly: false });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(ids as string[], columns);
        return result;
      }

      // Create or replace one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a, b as EditableData<Record>, columns, { createOnly: false, ifVersion });
      }

      // Create or replace one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        if (a.xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a.xata_id, { ...a, xata_id: undefined }, columns, {
          createOnly: false,
          ifVersion
        });
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as EditableData<Record>, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined(a.xata_id)) {
        return await this.create(a as EditableData<Record>, b as K[]);
      }

      throw new Error('Invalid arguments for createOrReplace method');
    });
  }

  async delete<K extends SelectableColumn<Record>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async delete(object: Identifiable): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async delete<K extends SelectableColumn<Record>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;
  async delete(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;
  async delete<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async delete(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async delete<K extends SelectableColumn<Record>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>> | null>>;
  async delete(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>> | null>>;
  async delete<K extends SelectableColumn<Record>>(
    a: Identifier | Identifiable | Array<Identifier | Identifiable>,
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

        const ids = a.map((o) => {
          if (isString(o)) return o;
          if (isString(o.xata_id)) return o.xata_id;
          throw new Error('Invalid arguments for delete method');
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a as any, columns);

        await this.#deleteRecords(ids);

        return result;
      }

      // Delete one record with id as param
      if (isString(a)) {
        return this.#deleteRecord(a, b);
      }

      // Delete one record with id as property
      if (isObject(a) && isString(a.xata_id)) {
        return this.#deleteRecord(a.xata_id, b);
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
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;
  async deleteOrThrow(id: Identifier): Promise<Readonly<SelectedPick<Record, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Array<Partial<EditableData<Record>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async deleteOrThrow(
    objects: Array<Partial<EditableData<Record>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<Record, typeof columns>>>>;
  async deleteOrThrow(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<Record, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<Record>>(
    a: Identifier | Identifiable | Array<Identifier | Identifiable>,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<Record, ['*']>>
    | Array<Readonly<SelectedPick<Record, ['*']>>>
    | Readonly<SelectedPick<Record, K[]>>
    | Array<Readonly<SelectedPick<Record, K[]>>>
  > {
    return this.#trace('deleteOrThrow', async () => {
      const result = await this.delete(a as any, b as any);

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
      } else if (result === null) {
        const id = extractId(a) ?? 'unknown';
        throw new Error(`Record with id ${id} not found`);
      }

      return result;
    });
  }

  async #deleteRecord(recordId: Identifier, columns: SelectableColumn<Record>[] = ['*']) {
    if (!recordId) return null;

    try {
      const response = await deleteRecord({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table,
          recordId
        },
        queryParams: { columns },
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();
      return initObject(this.#db, schemaTables, this.#table, response, columns) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async #deleteRecords(recordIds: Identifier[]) {
    const chunkedOperations: TransactionOperation[][] = chunk(
      compact(recordIds).map((id) => ({ delete: { table: this.#table, id } })),
      BULK_OPERATION_MAX_SIZE
    );

    for (const operations of chunkedOperations) {
      await branchTransaction({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}'
        },
        body: { operations },
        ...this.#getFetchProps()
      });
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
      page?: SearchPageConfig;
      target?: TargetColumn<Record>[];
    } = {}
  ) {
    return this.#trace('search', async () => {
      const { records, totalCount } = await searchTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          query,
          fuzziness: options.fuzziness,
          prefix: options.prefix,
          highlight: options.highlight,
          filter: options.filter as Schemas.FilterExpression,
          boosters: options.boosters as Schemas.BoosterExpression[],
          page: options.page,
          target: options.target as Schemas.TargetExpression
        },
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) => initObject(this.#db, schemaTables, this.#table, item, ['*'])) as any,
        totalCount
      };
    });
  }

  async vectorSearch<F extends ColumnsByValue<Record, number[]>>(
    column: F,
    query: number[],
    options?:
      | {
          similarityFunction?: string | undefined;
          size?: number | undefined;
          filter?: Filter<Record> | undefined;
        }
      | undefined
  ): Promise<{ records: SearchXataRecord<SelectedPick<Record, ['*']>>[] } & TotalCount> {
    return this.#trace('vectorSearch', async () => {
      const { records, totalCount } = await vectorSearchTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          column,
          queryVector: query,
          similarityFunction: options?.similarityFunction,
          size: options?.size,
          filter: options?.filter as Schemas.FilterExpression
        },
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) => initObject(this.#db, schemaTables, this.#table, item, ['*'])),
        totalCount
      } as any;
    });
  }

  async aggregate<Expression extends Dictionary<AggregationExpression<Record>>>(
    aggs?: Expression,
    filter?: Filter<Record>
  ) {
    return this.#trace('aggregate', async () => {
      const result = await aggregateTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: { aggs, filter: filter as Schemas.FilterExpression },
        ...this.#getFetchProps()
      });

      return result as any;
    });
  }

  async query<Result extends XataRecord>(query: Query<Record, Result>): Promise<Page<Record, Result>> {
    return this.#trace('query', async () => {
      const data = query.getQueryOptions();

      const { meta, records: objects } = await queryTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          filter: cleanFilter(data.filter),
          sort: data.sort !== undefined ? buildSortFilter(data.sort) : undefined,
          page: data.pagination,
          columns: data.columns ?? ['*'],
          consistency: data.consistency
        },
        fetchOptions: data.fetchOptions,
        ...this.#getFetchProps()
      });

      const schemaTables = await this.#getSchemaTables();
      const records = objects.map((record) =>
        initObject<Result>(
          this.#db,
          schemaTables,
          this.#table,
          record,
          (data.columns as SelectableColumn<Result>[]) ?? ['*']
        )
      );

      return new Page<Record, Result>(query, meta, records);
    });
  }

  async summarizeTable<Result extends XataRecord>(
    query: Query<Record, Result>,
    summaries?: Dictionary<SummarizeExpression<Record>>,
    summariesFilter?: Schemas.FilterExpression
  ) {
    return this.#trace('summarize', async () => {
      const data = query.getQueryOptions();

      const result = await summarizeTable({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: this.#table
        },
        body: {
          filter: cleanFilter(data.filter),
          sort: data.sort !== undefined ? buildSortFilter(data.sort) : undefined,
          columns: data.columns as SelectableColumn<Record>[],
          consistency: data.consistency,
          page: data.pagination?.size !== undefined ? { size: data.pagination?.size } : undefined,
          summaries,
          summariesFilter
        },
        ...this.#getFetchProps()
      });
      const schemaTables = await this.#getSchemaTables();
      return {
        ...result,
        summaries: result.summaries.map((summary) =>
          initObject(this.#db, schemaTables, this.#table, summary, data.columns ?? [])
        )
      };
    });
  }

  ask(question: string, options?: AskOptions<Record> & { onMessage?: (message: AskResult) => void }): any {
    // Ask with session uses message, ask without session uses question param
    const questionParam = options?.sessionId ? { message: question } : { question };
    const params = {
      pathParams: {
        workspace: '{workspaceId}',
        dbBranchName: '{dbBranch}',
        region: '{region}',
        tableName: this.#table,
        sessionId: options?.sessionId
      },
      body: {
        ...questionParam,
        rules: options?.rules,
        searchType: options?.searchType,
        search: options?.searchType === 'keyword' ? options?.search : undefined,
        vectorSearch: options?.searchType === 'vector' ? options?.vectorSearch : undefined
      },
      ...this.#getFetchProps()
    };

    if (options?.onMessage) {
      fetchSSERequest({
        endpoint: 'dataPlane',
        url: '/db/{dbBranchName}/tables/{tableName}/ask/{sessionId}',
        method: 'POST',
        onMessage: (message: { text: string; records: string[] }) => {
          options.onMessage?.({ answer: message.text, records: message.records });
        },
        ...params
      });
    } else {
      return askTableSession(params as any);
    }
  }

  async #getSchemaTables(): Promise<Schemas.Table[]> {
    if (this.#schemaTables) return this.#schemaTables;

    const { schema } = await getBranchDetails({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
      ...this.#getFetchProps()
    });

    this.#schemaTables = schema.tables;
    return schema.tables;
  }

  async #transformObjectToApi(object: any): Promise<Schemas.DataInputRecord> {
    const schemaTables = await this.#getSchemaTables();
    const schema = schemaTables.find((table) => table.name === this.#table);
    if (!schema) throw new Error(`Table ${this.#table} not found in schema`);

    const result: Dictionary<any> = {};

    for (const [key, value] of Object.entries(object)) {
      // Ignore internal properties
      if (['xata_version', 'xata_createdat', 'xata_updatedat'].includes(key)) continue;

      const type = schema.columns.find((column) => column.name === key)?.type;

      switch (type) {
        case 'link': {
          result[key] = isIdentifiable(value) ? value.xata_id : value;
          break;
        }
        case 'datetime': {
          result[key] = value instanceof Date ? value.toISOString() : value;
          break;
        }
        case `file`:
          result[key] = await parseInputFileEntry(value as InputXataFile);
          break;
        case 'file[]':
          result[key] = await promiseMap(value as InputXataFile[], (item) => parseInputFileEntry(item));
          break;
        case 'json':
          result[key] = stringifyJson(value as any);
          break;
        default:
          result[key] = value;
      }
    }

    return result;
  }
}

export const initObjectKysely = <T>(
  db: SQLPluginFunction,
  schemaTables: Schemas.Table[],
  table: string,
  object: Record<string, any>,
  selectedColumns: SelectableColumn<T>[] | SelectableColumnWithObjectNotation<T>[]
) => {
  const data: Dictionary<unknown> = {};
  Object.assign(data, { ...object });

  const { columns } = schemaTables.find(({ name }) => name === table) ?? {};
  if (!columns) console.error(`Table ${table} not found in schema`);

  for (const column of columns ?? []) {
    // Ignore columns not selected
    if (!isValidColumn(selectedColumns, column)) continue;

    const value = data[column.name];

    switch (column.type) {
      case 'datetime': {
        const date = value !== undefined ? new Date(value as string) : null;

        if (date !== null && isNaN(date.getTime())) {
          console.error(`Failed to parse date ${value} for field ${column.name}`);
        } else {
          data[column.name] = date;
        }

        break;
      }
      case 'link': {
        const linkTable = column.link?.table;

        if (!linkTable) {
          console.error(`Failed to parse link for field ${column.name}`);
        } else if (isObject(value)) {
          const selectedLinkColumns = (selectedColumns as string[]).reduce((acc, item) => {
            if (item === column.name) {
              return [...acc, '*'];
            }

            if (isString(item) && item.startsWith(`${column.name}.`)) {
              const [, ...path] = item.split('.');
              return [...acc, path.join('.')];
            }

            return acc;
          }, [] as string[]);

          data[column.name] = initObjectKysely(
            db,
            schemaTables,
            linkTable,
            value,
            selectedLinkColumns as SelectableColumn<unknown>[]
          );
        } else {
          data[column.name] = null;
        }

        break;
      }
      case 'file':
        data[column.name] = isDefined(value) ? new XataFile(value as any) : null;
        break;
      case 'file[]':
        data[column.name] = (value as XataArrayFile[])?.map((item) => new XataFile(item)) ?? null;
        break;
      case 'json':
        data[column.name] = parseJson(value as string);
        break;
      default:
        data[column.name] = value ?? null;

        if (column.notNull === true && value === null) {
          console.error(`Parse error, column ${column.name} is non nullable and value resolves null`);
        }
        break;
    }
  }

  const record = { ...data };

  record.read = async function (columns?: any) {
    return await db({
      statement: `SELECT ${columns} FROM ${table} WHERE xata_id = ?`,
      params: [record['xata_id']]
    });
  };

  record.update = async function (data: any, b?: any, c?: any) {
    const columns = isValidSelectableColumns(b) ? b : ['*'];

    return await db({
      statement: `UPDATE ${table} SET ${columns} = ${data} WHERE xata_id = ?`,
      params: [record['xata_id']]
    });
  };

  record.replace = async function (data: any, b?: any, c?: any) {
    const columns = isValidSelectableColumns(b) ? b : ['*'];

    return await db({
      statement: `CREATE OR REPLACE INTO ${table} ${columns} VALUES ${data} WHERE xata_id = ?`,
      params: [record['xata_id']]
    });
  };

  record.delete = async function () {
    return await db({
      statement: `DELETE FROM ${table} WHERE xata_id = ?`,
      params: [record['xata_id']]
    });
  };

  record.toSerializable = function () {
    return JSON.parse(JSON.stringify(record));
  };

  record.toString = function () {
    return JSON.stringify(record);
  };

  for (const prop of ['read', 'update', 'replace', 'delete', 'toSerializable', 'toString']) {
    Object.defineProperty(record, prop, { enumerable: false });
  }

  Object.freeze(record);
  // `as unkwnown` to avoid TS error on versions prior to 4.9 (can be removed once we drop support for older versions)
  return record as unknown as T;
};

export const initObject = <T>(
  db: Record<string, Repository<any>>,
  schemaTables: Schemas.Table[],
  table: string,
  object: Record<string, any>,
  selectedColumns: SelectableColumn<T>[] | SelectableColumnWithObjectNotation<T>[]
) => {
  const data: Dictionary<unknown> = {};
  Object.assign(data, { ...object });

  const { columns } = schemaTables.find(({ name }) => name === table) ?? {};
  if (!columns) console.error(`Table ${table} not found in schema`);

  for (const column of columns ?? []) {
    // Ignore columns not selected
    if (!isValidColumn(selectedColumns, column)) continue;

    const value = data[column.name];

    switch (column.type) {
      case 'datetime': {
        const date = value !== undefined ? new Date(value as string) : null;

        if (date !== null && isNaN(date.getTime())) {
          console.error(`Failed to parse date ${value} for field ${column.name}`);
        } else {
          data[column.name] = date;
        }

        break;
      }
      case 'link': {
        const linkTable = column.link?.table;

        if (!linkTable) {
          console.error(`Failed to parse link for field ${column.name}`);
        } else if (isObject(value)) {
          const selectedLinkColumns = (selectedColumns as string[]).reduce((acc, item) => {
            if (item === column.name) {
              return [...acc, '*'];
            }

            if (isString(item) && item.startsWith(`${column.name}.`)) {
              const [, ...path] = item.split('.');
              return [...acc, path.join('.')];
            }

            return acc;
          }, [] as string[]);

          data[column.name] = initObject(
            db,
            schemaTables,
            linkTable,
            value,
            selectedLinkColumns as SelectableColumn<unknown>[]
          );
        } else {
          data[column.name] = null;
        }

        break;
      }
      case 'file':
        data[column.name] = isDefined(value) ? new XataFile(value as any) : null;
        break;
      case 'file[]':
        data[column.name] = (value as XataArrayFile[])?.map((item) => new XataFile(item)) ?? null;
        break;
      case 'json':
        data[column.name] = parseJson(value as string);
        break;
      default:
        data[column.name] = value ?? null;

        if (column.notNull === true && value === null) {
          console.error(`Parse error, column ${column.name} is non nullable and value resolves null`);
        }
        break;
    }
  }

  const record = { ...data };

  record.read = function (columns?: any) {
    return db[table].read(record['xata_id'] as string, columns);
  };

  record.update = function (data: any, b?: any, c?: any) {
    const columns = isValidSelectableColumns(b) ? b : ['*'];
    const ifVersion = parseIfVersion(b, c);

    return db[table].update(record['xata_id'] as string, data, columns, { ifVersion });
  };

  record.replace = function (data: any, b?: any, c?: any) {
    const columns = isValidSelectableColumns(b) ? b : ['*'];
    const ifVersion = parseIfVersion(b, c);

    return db[table].createOrReplace(record['xata_id'] as string, data, columns, { ifVersion });
  };

  record.delete = function () {
    return db[table].delete(record['xata_id'] as string);
  };

  record.toSerializable = function () {
    return JSON.parse(JSON.stringify(record));
  };

  record.toString = function () {
    return JSON.stringify(record);
  };

  for (const prop of ['read', 'update', 'replace', 'delete', 'toSerializable', 'toString']) {
    Object.defineProperty(record, prop, { enumerable: false });
  }

  Object.freeze(record);
  // `as unkwnown` to avoid TS error on versions prior to 4.9 (can be removed once we drop support for older versions)
  return record as unknown as T;
};

function extractId(value: any): Identifier | undefined {
  if (isString(value)) return value;
  if (isObject(value) && isString(value.xata_id)) return value.xata_id;
  return undefined;
}

function isValidColumn(
  columns: SelectableColumn<any>[] | SelectableColumnWithObjectNotation<any>[],
  column: Schemas.Column
) {
  // Every column alias
  if (columns.includes('*')) return true;

  // Match column name and all its children (foo, foo.bar, foo.bar.baz)
  return columns.filter((item) => isString(item) && item.startsWith(column.name)).length > 0;
}

function parseIfVersion(...args: any[]): number | undefined {
  for (const arg of args) {
    if (isObject(arg) && isNumber(arg.ifVersion)) {
      return arg.ifVersion;
    }
  }

  return undefined;
}
