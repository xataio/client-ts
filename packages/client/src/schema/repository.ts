import { DatabaseSchema, SchemaPluginResult } from '.';
import {
  ApiExtraProps,
  Schemas,
  SqlBatchQueryRequestBody,
  aggregateTable,
  askTableSession,
  branchTransaction,
  deleteRecord,
  getRecord,
  insertRecord,
  insertRecordWithID,
  queryTable,
  searchTable,
  sqlBatchQuery,
  summarizeTable,
  updateRecordWithID,
  upsertRecordWithID,
  vectorSearchTable
} from '../api';
import { fetchSSERequest } from '../api/fetcher';
import {
  BranchSchema,
  FuzzinessExpression,
  HighlightExpression,
  PrefixExpression,
  Schema,
  SearchPageConfig,
  TransactionOperation
} from '../api/schemas';
import { XataPluginOptions } from '../plugins';
import { SearchXataRecord, TotalCount } from '../search';
import { Boosters } from '../search/boosters';
import { TargetColumn } from '../search/target';
import { chunk, compact, isDefined, isNumber, isObject, isString, isStringOrNumber, promiseMap } from '../util/lang';
import { Dictionary } from '../util/types';
import { generateUUID } from '../util/uuid';
import { VERSION } from '../version';
import { AggregationExpression, AggregationResult } from './aggregate';
import { AskOptions, AskResult } from './ask';
import { XataArrayFile, XataFile, parseInputFileEntry } from './files';
import { Filter, atPath, cleanFilter, filterToKysely, relevantFilters } from './filters';
import { parseJson, stringifyJson } from './json';
import {
  CursorNavigationDecoded,
  PAGINATION_DEFAULT_OFFSET,
  PAGINATION_DEFAULT_SIZE,
  PAGINATION_MAX_OFFSET,
  PAGINATION_MAX_SIZE,
  Page
} from './pagination';
import { Query } from './query';
import { EditableData, Identifiable, Identifier, InputXataFile, XataRecord, isIdentifiable } from './record';
import {
  ColumnSelectionObject,
  ColumnsByValue,
  SelectableColumn,
  SelectableColumnWithObjectNotation,
  SelectedPick,
  isValidSelectableColumns
} from './selection';
import { ApiSortFilter, SortDirection, buildSortFilter, isSortFilterObject } from './sorting';
import { SummarizeExpression } from './summarize';
import { AttributeDictionary, TraceAttributes, TraceFunction, defaultTrace } from './tracing';
import {
  AliasedRawBuilder,
  DeleteQueryBuilder,
  Expression,
  ExpressionBuilder,
  InsertQueryBuilder,
  RawBuilder,
  SelectExpression,
  SelectQueryBuilder,
  Selection,
  Simplify,
  UpdateQueryBuilder,
  sql
} from 'kysely';
import { BinaryOperatorExpression } from 'kysely/dist/cjs/parser/binary-operation-parser';
import { SQLBatchResponse } from '../api/dataPlaneResponses';
import { Cursor, decode } from '@xata.io/sql';
import { KyselyPlugin, KyselyPluginResult } from '../kysely';
import {
  NewEditableData,
  NewEditableDataWithoutNumeric,
  NewIdentifiable,
  NewIdentifierKey,
  NewIndentifierValue
} from './identifiable';
import { Model } from '@xata.io/kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { ObjectType } from 'typescript';

const BULK_OPERATION_MAX_SIZE = 1000;

/**
 * Common interface for performing operations on a table.
 */
export abstract class Repository<Schema extends DatabaseSchema, TableName extends string, ObjectType> extends Query<
  Schema,
  TableName,
  ObjectType,
  Readonly<SelectedPick<ObjectType, ['*']>>
> {
  /*
   * Creates a single record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract create<K extends SelectableColumn<ObjectType>>(
    object: NewEditableDataWithoutNumeric<ObjectType>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /*
   * Creates a single record in the table.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(
    object: NewEditableDataWithoutNumeric<ObjectType>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Creates a single record in the table with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract create<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<
      NewEditableDataWithoutNumeric<ObjectType>,
      NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>
    >,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Creates a single record in the table with a unique id.
   * @param id The unique id.
   * @param object Object containing the column names with their values to be stored in the table.
   * @returns The full persisted record.
   */
  abstract create(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<
      NewEditableDataWithoutNumeric<ObjectType>,
      NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>
    >,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order.
   */
  abstract create<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;

  /**
   * Creates multiple records in the table.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records in order.
   */
  abstract create(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns> | null>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']> | null>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read<K extends SelectableColumn<ObjectType>>(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read<K extends SelectableColumn<ObjectType>>(
    object: NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns> | null>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @returns The persisted record for the given id or null if the record could not be found.
   */
  abstract read(
    object: NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']> | null>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read<K extends SelectableColumn<ObjectType>>(
    objects: NewIdentifiable<Schema['tables']>[TableName][],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @returns The persisted records for the given ids in order (if a record could not be found null is returned).
   */
  abstract read(
    objects: NewIdentifiable<Schema['tables']>[TableName][]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Queries a single record from the table given its unique id.
   * @param id The unique id.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<ObjectType>>(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;

  /**
   * Queries multiple records from the table given their unique id.
   * @param ids The unique ids array.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<ObjectType>>(
    object: NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Queries a single record from the table by the id in the object.
   * @param object Object containing the id of the record.
   * @returns The persisted record for the given id.
   * @throws If the record could not be found.
   */
  abstract readOrThrow(
    object: NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: NewIdentifiable<Schema['tables']>[TableName][],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;

  /**
   * Queries multiple records from the table by the ids in the objects.
   * @param objects Array of objects containing the ids of the records.
   * @returns The persisted records for the given ids in order.
   * @throws If one or more records could not be found.
   */
  abstract readOrThrow(
    objects: NewIdentifiable<Schema['tables']>[TableName][]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update<K extends SelectableColumn<ObjectType>>(
    object: NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update(
    object: NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableData<ObjectType>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @returns The full persisted record, null if the record could not be found.
   */
  abstract update(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order (if a record could not be found null is returned).
   */
  abstract update<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @returns Array of the persisted records in order (if a record could not be found null is returned).
   */
  abstract update(
    objects: Array<NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<ObjectType>>(
    object: NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Partially update a single record.
   * @param object An object with its id and the columns to be updated.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow(
    object: NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableData<ObjectType>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Partially update a single record given its unique id.
   * @param id The unique id.
   * @param object The column names and their values that have to be updated.
   * @returns The full persisted record.
   * @throws If the record could not be found.
   */
  abstract updateOrThrow(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableData<ObjectType>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records in order.
   * @throws If one or more records could not be found.
   */
  abstract updateOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;

  /**
   * Partially updates multiple records.
   * @param objects An array of objects with their ids and columns to be updated.
   * @returns Array of the persisted records in order.
   * @throws If one or more records could not be found.
   */
  abstract updateOrThrow(
    objects: Array<NewEditableData<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrUpdate<K extends SelectableColumn<ObjectType>>(
    object: NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(
    object: NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrUpdate<K extends SelectableColumn<ObjectType>>(
    id: undefined | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<
      NewEditableDataWithoutNumeric<ObjectType>,
      NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>
    >,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract createOrUpdate(
    id: undefined | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<
      NewEditableDataWithoutNumeric<ObjectType>,
      NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>
    >,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records.
   */
  abstract createOrUpdate<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;

  /**
   * Creates or updates a single record. If a record exists with the given id,
   * it will be partially updated, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createOrUpdate(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrReplace<K extends SelectableColumn<ObjectType>>(
    object: NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param object Object containing the column names with their values to be persisted in the table.
   * @returns The full persisted record.
   */
  abstract createOrReplace(
    object: NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The full persisted record.
   */
  abstract createOrReplace<K extends SelectableColumn<ObjectType>>(
    id: undefined | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<
      NewEditableDataWithoutNumeric<ObjectType>,
      NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>
    >,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param id A unique id.
   * @param object The column names and the values to be persisted.
   * @returns The full persisted record.
   */
  abstract createOrReplace(
    id: undefined | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<
      NewEditableDataWithoutNumeric<ObjectType>,
      NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>
    >,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the persisted records.
   */
  abstract createOrReplace<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;

  /**
   * Creates or replaces a single record. If a record exists with the given id,
   * it will be replaced, otherwise a new record will be created.
   * @param objects Array of objects with the column names and the values to be stored in the table.
   * @returns Array of the persisted records.
   */
  abstract createOrReplace(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete<K extends SelectableColumn<ObjectType>>(
    object: NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete(
    object: NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @returns The deleted record, null if the record could not be found.
   */
  abstract delete(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete<K extends SelectableColumn<ObjectType>>(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   */
  abstract delete(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    object: NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Deletes a record given its unique id.
   * @param object An object with a unique id.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow(
    object: NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;

  /**
   * Deletes a record given a unique id.
   * @param id The unique id.
   * @returns The deleted record, null if the record could not be found.
   * @throws If the record could not be found.
   */
  abstract deleteOrThrow(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;

  /**
   * Deletes multiple records given an array of objects with ids.
   * @param objects An array of objects with unique ids.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @param columns Array of columns to be returned. If not specified, first level columns will be returned.
   * @returns Array of the deleted records in order (if a record could not be found null is returned).
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;

  /**
   * Deletes multiple records given an array of unique ids.
   * @param objects An array of ids.
   * @returns Array of the deleted records in order.
   * @throws If one or more records could not be found.
   */
  abstract deleteOrThrow(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;

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
      filter?: Filter<ObjectType>;
      boosters?: Boosters<ObjectType>[];
      page?: SearchPageConfig;
      target?: TargetColumn<ObjectType>[];
    }
  ): Promise<{ records: SearchXataRecord<SelectedPick<ObjectType, ['*']>>[] } & TotalCount>;

  /**
   * Search for vectors in the table.
   * @param column The column to search for.
   * @param query The vector to search for similarities. Must have the same dimension as the vector column used.
   * @param options The options to search with (like: spaceFunction)
   */
  abstract vectorSearch<F extends ColumnsByValue<ObjectType, number[]>>(
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
      filter?: Filter<ObjectType>;
    }
  ): Promise<{ records: SearchXataRecord<SelectedPick<ObjectType, ['*']>>[] } & TotalCount>;

  /**
   * Aggregates records in the table.
   * @param expression The aggregations to perform.
   * @param filter The filter to apply to the queried records.
   * @returns The requested aggregations.
   */
  abstract aggregate<Expression extends Dictionary<AggregationExpression<ObjectType>>>(
    expression?: Expression,
    filter?: Filter<ObjectType>
  ): Promise<AggregationResult<ObjectType, Expression>>;

  /**
   * Experimental: Ask the database to perform a natural language question.
   */
  abstract ask(question: string, options?: AskOptions<ObjectType>): Promise<AskResult>;

  /**
   * Experimental: Ask the database to perform a natural language question.
   */
  abstract ask(question: string, options: AskOptions<ObjectType>): Promise<AskResult>;

  /**
   * Experimental: Ask the database to perform a natural language question.
   */
  abstract ask(question: string, options: AskOptions<ObjectType> & { onMessage: (message: AskResult) => void }): void;

  abstract query<Result extends XataRecord>(
    query: Query<Schema, TableName, ObjectType, Result>
  ): Promise<Page<Schema, TableName, ObjectType, Result>>;
}

const computePrimaryKey = (schema: Schema, tableName: string): string => {
  const table = schema.tables.find((table) => table.name === tableName);
  const primaryKeys = (table as any)?.primaryKey ?? [];
  if (primaryKeys.length === 1) {
    // Throwing an error here if the primary key is not an Int or String instead of silently failing.
    const primaryKeyType = table?.columns.find((col) => col.name === primaryKeys[0])?.type;
    const validIdXataTypes = ['string', 'text', 'int', 'float'];
    if (primaryKeyType && !validIdXataTypes.includes(primaryKeyType)) {
      throw new Error(
        `Primary key on ${tableName} must be one of type ${validIdXataTypes.join(', ')} to use the Xata SDK.`
      );
    }
    return primaryKeys[0];
  } else if (primaryKeys.length > 1) {
    throw new Error(`Composite primary key on ${tableName} is not supported`);
  } else {
    const xata_id = table?.columns.find((col) => col.name === 'xata_id' && col.notNull);
    if (!xata_id) {
      throw new Error(
        `Could not find a non composite primary key or xata_id on ${tableName} table. Create a primary key of adapt your table with Xata.`
      );
    }
    return 'xata_id';
  }
};

export class KyselyRepository<Schema extends DatabaseSchema, TableName extends string, ObjectType>
  extends Query<Schema, TableName, ObjectType, SelectedPick<ObjectType, ['*']>>
  implements Repository<Schema, TableName, ObjectType>
{
  #table: string;
  #getFetchProps: () => ApiExtraProps;
  #db: KyselyPluginResult<any>;
  #schema: DatabaseSchema;
  #trace: TraceFunction;
  #runTransaction: (params: SqlBatchQueryRequestBody) => Promise<SQLBatchResponse['results'][number]['records']>;
  #primaryKey: string;

  constructor(options: {
    table: string;
    db: SchemaPluginResult<any>;
    pluginOptions: XataPluginOptions;
    schema: DatabaseSchema;
  }) {
    super(
      null,
      { name: options.table, schema: options.schema.tables.find((table) => table.name === options.table) },
      {}
    );

    this.#table = options.table;
    this.#db = new KyselyPlugin().build(options.pluginOptions);
    // pass plugin options here.
    this.#schema = options.schema;
    this.#getFetchProps = () => ({ ...options.pluginOptions, sessionID: generateUUID() });
    this.#primaryKey = computePrimaryKey(this.#schema as any, this.#table);
    this.#runTransaction = async (body: SqlBatchQueryRequestBody) => {
      body.statements.unshift({
        statement: 'BEGIN',
        params: []
      });
      body.statements.push({
        statement: 'COMMIT',
        params: []
      });
      const { results } = await sqlBatchQuery({
        pathParams: {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}'
        },
        ...this.#getFetchProps(),
        body
      });
      return results.flatMap((result) => {
        if (result.warning) console.warn(result.warning);
        return result.records?.map((record) => record) ?? [];
      });
    };

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

  async create<K extends SelectableColumn<ObjectType>>(
    object: NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async create(
    object: NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async create<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableDataWithoutNumeric<ObjectType>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async create(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableDataWithoutNumeric<ObjectType>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async create<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async create(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async create<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | (NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>)
      | Array<NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    b?: NewEditableDataWithoutNumeric<ObjectType> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Readonly<SelectedPick<ObjectType, K[]>>[]
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Readonly<SelectedPick<ObjectType, ['*']>>[]
  > {
    return this.#trace('create', async () => {
      // Create many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];
        const records = await this.#insertRecords(a, { createOnly: true });
        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(records as NewIdentifiable<Schema['tables']>[TableName][], columns);
        return result;
      }

      // Create one record with id as param
      if (isStringOrNumber(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a as any, b as NewEditableData<ObjectType>, columns, {
          createOnly: true
        });
      }

      // Create one record with id as property
      if (isObject(a) && isStringOrNumber((a as any)[this.#primaryKey])) {
        if ((a as any)[this.#primaryKey] === '') {
          throw new Error("The id can't be empty");
        }
        const columns = isValidSelectableColumns(b) ? b : undefined;
        return await this.#insertRecordWithId(
          (a as any)[this.#primaryKey],
          { ...a, [this.#primaryKey]: undefined } as NewEditableData<ObjectType>,
          columns,
          {
            createOnly: true
          }
        );
      }

      // Create one record without id
      if (isObject(a)) {
        const columns = isValidSelectableColumns(b) ? b : undefined;
        return await this.#insertRecordWithoutId(a as any, columns);
      }
      throw new Error('Invalid arguments for create method');
    });
  }

  async #insertRecordWithoutId(object: NewEditableData<ObjectType>, columns: SelectableColumn<ObjectType>[] = ['*']) {
    const record = await this.#transformObjectToApi(object);

    let statement: InsertQueryBuilder<any, any, any> = this.#db.insertInto(this.#table);
    if (Object.keys(record).length === 0) {
      statement = statement.defaultValues();
    } else {
      statement = statement.values(record);
    }
    if (selectAllColumns(columns)) {
      statement = statement.returningAll();
    } else {
      statement = statement.returning(columns);
    }
    const response = await statement.executeTakeFirst();

    return initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, response, columns);
  }

  async #insertRecordWithId(
    recordId: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableData<ObjectType>,
    columns: SelectableColumn<ObjectType>[] = ['*'],
    { createOnly }: { createOnly: boolean }
  ) {
    if (!recordId) return null;

    const record = await this.#transformObjectToApi(object);

    let statement: InsertQueryBuilder<any, any, any> = this.#db
      .insertInto(this.#table)
      .values({ ...record, [this.#primaryKey]: recordId });

    if (selectAllColumns(columns)) {
      statement = statement.returningAll();
    } else {
      statement = statement.returning(columns);
    }
    if (!createOnly) {
      // any fields that are not in the record should be set to null
      const fieldsToSetNull = await this.#transformObjectToApiAllFields(record);
      statement = statement.onConflict((oc) =>
        oc.column(this.#primaryKey).doUpdateSet({ ...fieldsToSetNull, ...record, [this.#primaryKey]: recordId })
      );
    }

    const response = await statement.executeTakeFirst().catch((e) => {
      if (e.status === 400 && e.message.includes('constraint violation')) {
        e.status = 422;
      }
      throw e;
    });

    return initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, response, columns) as any;
  }

  async #insertRecords(objects: NewEditableData<ObjectType>[], { createOnly }: { createOnly: boolean }) {
    const operations = await promiseMap(objects, async (object) => await this.#transformObjectToApi(object));

    const statements: SqlBatchQueryRequestBody['statements'] = [];
    for (const operation of operations) {
      let statement: InsertQueryBuilder<any, any, any> = this.#db
        .insertInto(this.#table)
        .values(operation)
        .returningAll();
      if (!createOnly) {
        // any fields that are not in the record should be set to null
        const fieldsToSetNull = await this.#transformObjectToApiAllFields(operation);
        statement = statement.onConflict((oc) =>
          oc.column(this.#primaryKey).doUpdateSet({ ...fieldsToSetNull, ...operation })
        );
      }
      statements.push({ statement: statement.compile().sql, params: statement.compile().parameters as any[] });
    }

    const results = await this.#runTransaction({ statements });

    return results;
  }

  async read<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns> | null>>;
  async read(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async read(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    object: NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns> | null>>;
  async read(
    object: NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    objects: NewIdentifiable<Schema['tables']>[TableName][],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async read(
    objects: NewIdentifiable<Schema['tables']>[TableName][]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>
      | NewIdentifiable<Schema['tables']>[TableName]
      | NewIdentifiable<Schema['tables']>[TableName][],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>> | null>
    | null
  > {
    return this.#trace('read', async () => {
      const columns = isValidSelectableColumns(b) ? b : ['*' as const];
      // Read many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = a.map((item) => extractIdKysely(item, this.#primaryKey));

        const finalObjects = await this.getAll({ filter: { [this.#primaryKey]: { $any: compact(ids) } }, columns });
        // Maintain order of objects
        const dictionary = finalObjects.reduce((acc, object) => {
          acc[(object as any)[this.#primaryKey]] = object;
          return acc;
        }, {} as Dictionary<any>);

        return ids.map((id) => dictionary[id ?? ('' as any)] ?? null);
      }

      // Read one record
      const id = extractIdKysely(a, this.#primaryKey);
      if (id) {
        try {
          let statement: SelectQueryBuilder<any, any, any> = this.#db
            .selectFrom(this.#table)
            .where(this.#primaryKey, '=', id);

          statement = generateSelectStatement({
            columnData: (this.#schema?.tables.find((table) => table.name === this.#table)?.columns as any) ?? [],
            filter: {},
            columns,
            stmt: statement,
            schema: this.#schema as any,
            primaryKey: this.#primaryKey,
            tableName: this.#table,
            db: this.#db
          });

          const response = await statement.executeTakeFirst();
          if (!response) return null;
          return initObjectKysely<ObjectType>(
            this,
            this.#schema,
            this.#primaryKey,
            this.#table,
            response,
            columns as SelectableColumn<ObjectType>[]
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

  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async readOrThrow(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async readOrThrow(
    ids: ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    object: NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async readOrThrow(
    object: NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: NewIdentifiable<Schema['tables']>[TableName][],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async readOrThrow(
    objects: NewIdentifiable<Schema['tables']>[TableName][]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | ReadonlyArray<NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>>
      | NewIdentifiable<Schema['tables']>[TableName]
      | NewIdentifiable<Schema['tables']>[TableName][],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Readonly<SelectedPick<ObjectType, ['*']>>[]
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Readonly<SelectedPick<ObjectType, K[]>>[]
  > {
    return this.#trace('readOrThrow', async () => {
      const result = await this.read(a as any, b as any);

      if (Array.isArray(result)) {
        const missingIds = compact(
          (a as Array<string | NewIdentifiable<Schema['tables']>[TableName]>)
            .filter((_item, index) => result[index] === null)
            .map((item) => extractIdKysely(item, this.#primaryKey))
        );

        if (missingIds.length > 0) {
          throw new Error(`Could not find records with ids: ${missingIds.join(', ')}`);
        }

        return result as any;
      }

      if (result === null) {
        const id = extractIdKysely(a, this.#primaryKey) ?? 'unknown';
        throw new Error(`Record with id ${id} not found`);
      }

      return result;
    });
  }

  async update<K extends SelectableColumn<ObjectType>>(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async update(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async update<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async update(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async update<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async update(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async update<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | (Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName])
      | Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    b?: Partial<NewEditableData<ObjectType>> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>> | null>
    | null
  > {
    return this.#trace('update', async () => {
      // Update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        // TODO: Transaction API fails fast if one of the records is not found
        const existing = await this.read(a, [this.#primaryKey] as SelectableColumn<ObjectType>[]);
        const updates = a.filter((_item, index) => (existing as any)[index] !== null);

        await this.#updateRecords(updates as any, {
          upsert: false
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a, columns);
        return result;
      }

      try {
        // Update one record with id as param
        if (isStringOrNumber(a) && isObject(b)) {
          const columns = isValidSelectableColumns(c) ? c : undefined;
          return await this.#updateRecordWithID(a as any, b as any, columns);
        }

        // Update one record with id as property
        if (isObject(a) && isStringOrNumber(a[this.#primaryKey])) {
          const columns = isValidSelectableColumns(b) ? b : undefined;
          return await this.#updateRecordWithID(
            a[this.#primaryKey] as any,
            { ...(a as any), [this.#primaryKey]: undefined } as any,
            columns
          );
        }
      } catch (error: any) {
        if (error.status === 422) return null;
        throw error;
      }

      throw new Error('Invalid arguments for update method');
    });
  }

  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async updateOrThrow(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async updateOrThrow(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async updateOrThrow(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | (Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName])
      | Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    b?: Partial<NewEditableData<ObjectType>> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
  > {
    return this.#trace('updateOrThrow', async () => {
      const result = await this.update(a as any, b as any, c as any);

      if (Array.isArray(result)) {
        const missingIds = compact(
          (a as Array<string | NewIdentifiable<Schema['tables']>[TableName]>)
            .filter((_item, index) => result[index] === null)
            .map((item) => extractIdKysely(item, this.#primaryKey))
        );

        if (missingIds.length > 0) {
          throw new Error(`Could not find records with ids: ${missingIds.join(', ')}`);
        }

        return result as any;
      }

      if (result === null) {
        const id = extractIdKysely(a, this.#primaryKey) ?? 'unknown';
        throw new Error(`Record with id ${id} not found`);
      }

      return result;
    });
  }

  async #updateRecordWithID(
    recordId: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>,
    columns: SelectableColumn<ObjectType>[] = ['*']
  ) {
    if (!recordId) return null;

    // Ensure id is not present in the update payload
    const { [this.#primaryKey]: _id, ...record } = await this.#transformObjectToApi(object);

    const numericOperations: NumericOperations[] = extractNumericOperations({ numericFilters: record });
    try {
      let statement: UpdateQueryBuilder<any, any, any, any> = this.#db
        .updateTable(this.#table)
        .where(this.#primaryKey, '=', recordId);

      if (Object.keys(record).length > 0) {
        statement = statement.set(record);
      }

      if (numericOperations.length > 0) {
        for (const { field, operator, value } of numericOperations) {
          statement = statement.set((eb) => ({ [field]: eb(field, operatorMap[operator], value) }));
        }
      }
      if (selectAllColumns(columns)) {
        statement = statement.returningAll();
      } else {
        statement = statement.returning(columns);
      }
      const response = await statement.executeTakeFirst();
      if (!response) return null;

      return initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, response, columns) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async #updateRecords(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    { upsert }: { upsert: boolean }
  ) {
    const operations = await promiseMap(objects, async (object) => {
      const fields = await this.#transformObjectToApi(object);
      return fields;
    });
    const statements: SqlBatchQueryRequestBody['statements'] = [];

    for (const operation of operations) {
      const { [this.#primaryKey]: id, ...fields } = operation;

      if (upsert) {
        const numericOperations: NumericOperations[] = extractNumericOperations({ numericFilters: fields });
        let statement: InsertQueryBuilder<any, any, any> = this.#db
          .insertInto(this.#table)
          .onConflict((oc) => oc.column(this.#primaryKey).doUpdateSet(fields))
          .returningAll();
        statement =
          Object.keys(fields).length === 0
            ? statement.defaultValues()
            : statement.values({ ...fields, [this.#primaryKey]: id });
        if (numericOperations.length > 0) {
          for (const { field, operator, value } of numericOperations) {
            statement = statement.values((eb) => ({ [field]: eb(field, operatorMap[operator], value) }));
          }
        }
        statements.push({
          statement: statement.compile().sql,
          params: statement.compile().parameters as any[]
        });
      } else {
        const numericOperations: NumericOperations[] = extractNumericOperations({ numericFilters: fields });
        let statement: UpdateQueryBuilder<any, any, any, any> = this.#db
          .updateTable(this.#table)
          .where(this.#primaryKey, '=', id as string)
          .returningAll();
        if (Object.keys(fields).length > 0) {
          statement = statement.set(fields);
        }
        if (numericOperations.length > 0) {
          for (const { field, operator, value } of numericOperations) {
            statement = statement.set((eb) => ({ [field]: eb(field, operatorMap[operator], value) }));
          }
        }
        statements.push({
          statement: statement.compile().sql,
          params: statement.compile().parameters as any[]
        });
      }
    }

    const results = await this.#runTransaction({ statements });
    return results;
  }

  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrUpdate(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrUpdate(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async createOrUpdate(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | NewEditableData<ObjectType>
      | NewEditableData<ObjectType>[],
    b?:
      | NewEditableData<ObjectType>
      | Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
      | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
  > {
    return this.#trace('createOrUpdate', async () => {
      // Create or update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        await this.#updateRecords(a as any, {
          upsert: true
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a as any[], columns);
        return result;
      }

      // Create or update one record with id as param
      if (isStringOrNumber(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#upsertRecordWithID(a as any, b as any, columns);
      }

      // Create or update one record with id as property
      if (isObject(a) && isStringOrNumber((a as any)[this.#primaryKey])) {
        if ((a as any)[this.#primaryKey] === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#upsertRecordWithID(
          (a as any)[this.#primaryKey],
          { ...a, [this.#primaryKey]: undefined } as any,
          columns
        );
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as any, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined((a as any)[this.#primaryKey])) {
        return await this.create(a as any, b as K[]);
      }

      throw new Error('Invalid arguments for createOrUpdate method');
    });
  }

  async #upsertRecordWithID(
    recordId: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<EditableData<ObjectType>, 'xata_id'>,
    columns: SelectableColumn<ObjectType>[] = ['*']
  ) {
    if (!recordId) return null;

    const updates = Object.fromEntries(Object.entries(object).map(([key, value]) => [key, value]));
    let statement: InsertQueryBuilder<any, any, any> = this.#db
      .insertInto(this.#table)
      .values({ ...object, [this.#primaryKey]: recordId })
      .onConflict((oc) => oc.column(this.#primaryKey).doUpdateSet(updates));
    if (selectAllColumns(columns)) {
      statement = statement.returningAll();
    } else {
      statement = statement.returning(columns);
    }
    const response = await statement.executeTakeFirst();

    return initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, response, columns) as any;
  }

  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrReplace(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]> | undefined,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrReplace(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]> | undefined,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async createOrReplace(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | NewEditableData<ObjectType>
      | NewEditableData<ObjectType>[]
      | undefined,
    b?:
      | NewEditableData<ObjectType>
      | Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
      | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
  > {
    return this.#trace('createOrReplace', async () => {
      // Create or replace many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const records = await this.#insertRecords(a, { createOnly: false });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(records as NewIdentifiable<Schema['tables']>[TableName][], columns);
        return result;
      }

      // Create or replace one record with id as param
      if (isStringOrNumber(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a as any, b as NewEditableData<ObjectType>, columns, {
          createOnly: false
        });
      }

      // Create or replace one record with id as property
      if (isObject(a) && isStringOrNumber((a as any)[this.#primaryKey])) {
        if ((a as any)[this.#primaryKey] === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(
          (a as any)[this.#primaryKey],
          { ...a, [this.#primaryKey]: undefined } as any,
          columns,
          {
            createOnly: false
          }
        );
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as any, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined((a as any)[this.#primaryKey])) {
        return await this.create(a as any, b as K[]);
      }

      throw new Error('Invalid arguments for createOrReplace method');
    });
  }

  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    object: NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async deleteOrThrow(
    object: NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async deleteOrThrow(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async deleteOrThrow(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async deleteOrThrow(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | NewIdentifiable<Schema['tables']>[TableName]
      | Array<
          | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
          | NewIdentifiable<Schema['tables']>[TableName]
        >,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
  > {
    return this.#trace('deleteOrThrow', async () => {
      const result = await this.delete(a as any, b as any);

      if (Array.isArray(result)) {
        const missingIds = compact(
          (a as Array<string | NewIdentifiable<Schema['tables']>[TableName]>)
            .filter((_item, index) => result[index] === null)
            .map((item) => extractIdKysely(item, this.#primaryKey))
        );

        if (missingIds.length > 0) {
          throw new Error(`Could not find records with ids: ${missingIds.join(', ')}`);
        }

        return result as any;
      } else if (result === null) {
        const id = extractIdKysely(a, this.#primaryKey) ?? 'unknown';
        throw new Error(`Record with id ${id} not found`);
      }

      return result;
    });
  }

  async delete<K extends SelectableColumn<ObjectType>>(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async delete(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async delete<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async delete(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async delete<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async delete(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async delete<K extends SelectableColumn<ObjectType>>(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async delete(
    objects: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async delete<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | NewIdentifiable<Schema['tables']>[TableName]
      | Array<
          | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
          | NewIdentifiable<Schema['tables']>[TableName]
        >,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>> | null>
    | null
  > {
    return this.#trace('delete', async () => {
      // Delete many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = a.map((o) => {
          if (isStringOrNumber(o)) return o;
          if (isStringOrNumber(o[this.#primaryKey])) return o[this.#primaryKey];
          throw new Error('Invalid arguments for delete method');
        });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(a as any, columns);

        await this.#deleteRecords(ids as any);

        return result;
      }

      // Delete one record with id as param
      if (isStringOrNumber(a)) {
        return await this.#deleteRecord(a as any, b);
      }

      // Delete one record with id as property
      if (isObject(a) && isStringOrNumber(a[this.#primaryKey])) {
        return await this.#deleteRecord((a as any)[this.#primaryKey], b);
      }

      throw new Error('Invalid arguments for delete method');
    });
  }

  async #deleteRecord(
    recordId: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: SelectableColumn<ObjectType>[] = ['*']
  ) {
    if (!recordId) return null;

    try {
      let statement: DeleteQueryBuilder<any, any, any> = this.#db
        .deleteFrom(this.#table)
        .where(this.#primaryKey, '=', recordId);
      if (selectAllColumns(columns)) {
        statement = statement.returningAll();
      } else {
        statement = statement.returning(columns);
      }
      const response = await statement.executeTakeFirst();
      if (!response) return null;
      return initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, response, columns) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async #deleteRecords(recordIds: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>[]) {
    const statements: SqlBatchQueryRequestBody['statements'] = recordIds.map((id) => {
      const statement = this.#db.deleteFrom(this.#table).where(this.#primaryKey, '=', id);
      return {
        statement: statement.compile().sql,
        params: statement.compile().parameters as any[]
      };
    });

    return await this.#runTransaction({
      statements
    });
  }

  async search(
    query: string,
    options: {
      fuzziness?: FuzzinessExpression;
      prefix?: PrefixExpression;
      highlight?: HighlightExpression;
      filter?: Filter<ObjectType>;
      boosters?: Boosters<ObjectType>[];
      page?: SearchPageConfig;
      target?: TargetColumn<ObjectType>[];
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

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) =>
          initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, item, ['*'])
        ) as any,
        totalCount
      };
    });
  }

  async vectorSearch<F extends ColumnsByValue<ObjectType, number[]>>(
    column: F,
    query: number[],
    options?:
      | {
          similarityFunction?: string | undefined;
          size?: number | undefined;
          filter?: Filter<ObjectType> | undefined;
        }
      | undefined
  ): Promise<{ records: SearchXataRecord<SelectedPick<ObjectType, ['*']>>[] } & TotalCount> {
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

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) =>
          initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, item, ['*'])
        ),
        totalCount
      } as any;
    });
  }

  async aggregate<Expression extends Dictionary<AggregationExpression<ObjectType>>>(
    aggs?: Expression,
    filter?: Filter<ObjectType>
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

  async query<Result extends XataRecord>(
    query: Query<Schema, TableName, ObjectType, Result>
  ): Promise<Page<Schema, TableName, ObjectType, Result>> {
    return this.#trace('query', async () => {
      const data = query.getQueryOptions();

      const cursorAfter = (data?.pagination as { after: string })?.after
        ? (decode((data?.pagination as { after: string }).after) as CursorNavigationDecoded)
        : undefined;

      const cursorBefore = (data?.pagination as { before: string })?.before
        ? (decode((data?.pagination as { before: string }).before) as CursorNavigationDecoded)
        : undefined;

      const cursorStart = (data?.pagination as { start: string })?.start
        ? (decode((data?.pagination as { start: string }).start) as CursorNavigationDecoded)
        : undefined;

      const cursorEnd = (data?.pagination as { end: string })?.end
        ? (decode((data?.pagination as { end: string }).end) as CursorNavigationDecoded)
        : undefined;

      const cursor = cursorAfter ?? cursorBefore ?? cursorStart ?? cursorEnd;

      const filter = cleanFilter(data.filter) ?? cleanFilter(cursor?.data?.filter);
      const sort = data.sort
        ? buildSortFilter(data.sort)
        : cursor?.data.sort
        ? buildSortFilter(cursor?.data?.sort)
        : undefined;
      const size = data?.pagination?.size ?? cursor?.data?.pagination?.size ?? PAGINATION_DEFAULT_SIZE;
      const offset = data?.pagination?.offset ?? cursor?.data?.pagination?.offset ?? PAGINATION_DEFAULT_OFFSET;

      const columnData = this.#schema?.tables.find((table) => table.name === this.#table)?.columns ?? [];

      if (size && size > PAGINATION_MAX_SIZE) throw new Error(`page size exceeds max limit of ${PAGINATION_MAX_SIZE}`);
      if (offset && offset > PAGINATION_MAX_OFFSET)
        throw new Error(`page offset must not exceed ${PAGINATION_MAX_OFFSET}`);
      if (data.sort && cursor) throw new Error('sort and cursor cannot be used together');

      let statement = this.#db.selectFrom(this.#table);

      statement = generateSelectStatement({
        columnData: columnData as any[],
        filter,
        columns: data.columns as any[],
        stmt: statement,
        schema: this.#schema as any,
        primaryKey: this.#primaryKey,
        tableName: this.#table,
        db: this.#db
      });

      if (size) {
        statement = statement.limit(size);
      }

      const buildSortStatement = (sort: ApiSortFilter<any, any>[]) => {
        const sortStatement = (statement: SelectQueryBuilder<any, any, any>, column: string, order: string) => {
          if (order === 'random') {
            return statement.orderBy(sql`random()`);
          }
          return statement.orderBy(column === '*' ? `${this.#primaryKey}` : `${column}`, order as SortDirection);
        };
        for (const element of sort) {
          if (isSortFilterObject(element)) {
            statement = sortStatement(statement, `${element.column}`, element.direction ?? 'asc');
          } else {
            const keys = Object.keys(element);
            for (const key of keys) {
              statement = sortStatement(statement, `${key}`, (element as any)[key]);
            }
          }
        }
      };

      if (sort) {
        buildSortStatement(Array.isArray(sort) ? sort : [sort]);
      } else {
        // Necessary for cursor pagination
        // TODO can you order by link fields?
        statement = statement.orderBy(`${this.#primaryKey}`, 'asc');
      }

      if (offset) {
        statement = statement.offset(offset);
      }

      if (cursorAfter) {
        statement = statement.where(this.#primaryKey, '>', cursorAfter.lastSeenId);
      }
      if (cursorBefore) {
        statement = statement.where(this.#primaryKey, '<', cursorBefore.lastSeenId);
      }
      if (cursorStart) {
        statement = statement.orderBy(this.#primaryKey, 'asc');
      }
      if (cursorEnd) {
        statement = statement.orderBy(this.#primaryKey, 'desc');
      }

      const response: {
        [key: string]: unknown;
      }[] = (await this.#db.executeQuery(statement)).rows;

      const lastSeenId: string = response.length > 0 ? (response[response.length - 1][this.#primaryKey] as string) : '';

      const nextItem: {
        [key: string]: unknown;
      }[] = (await this.#db.executeQuery(statement.clearLimit().clearOffset().offset(response.length).limit(1))).rows;

      const records = response
        .filter((record) => Object.keys(record).length > 0)
        .map((record) =>
          initObjectKysely<Result>(
            this,
            this.#schema,
            this.#primaryKey,
            this.#table,
            record,
            (data.columns as SelectableColumn<Result>[]) ?? ['*']
          )
        );
      const meta = {
        page: {
          more: nextItem.length > 0,
          size,
          cursor: Cursor.from({
            lastSeenId: lastSeenId,
            data: {
              ...data,
              pagination: {
                size,
                offset
              }
            }
          }).toString()
        }
      };
      return new Page<Schema, TableName, ObjectType, Result>(query, meta, records);
    });
  }

  async summarizeTable<Result extends XataRecord>(
    query: Query<Schema, TableName, ObjectType, Result>,
    summaries?: Dictionary<SummarizeExpression<ObjectType>>,
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
          columns: data.columns as SelectableColumn<ObjectType>[],
          consistency: data.consistency,
          page: data.pagination?.size !== undefined ? { size: data.pagination?.size } : undefined,
          summaries,
          summariesFilter
        },
        ...this.#getFetchProps()
      });
      return {
        ...result,
        summaries: result.summaries.map((summary) =>
          initObjectKysely(this, this.#schema, this.#primaryKey, this.#table, summary, data.columns ?? [])
        )
      };
    });
  }

  ask(question: string, options?: AskOptions<ObjectType> & { onMessage?: (message: AskResult) => void }): any {
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

  async #transformObjectToApiAllFields(object: any): Promise<Schemas.DataInputRecord> {
    const schema = this.#schema.tables.find((table) => table.name === this.#table);
    if (!schema) throw new Error(`Table ${this.#table} not found in schema`);

    const result: Dictionary<any> = {};

    for (const column of schema.columns) {
      // Ignore internal properties
      if (['xata_version', 'xata_createdat', 'xata_updatedat'].includes(column.name)) continue;
      if (Object.keys(object).includes(column.name)) continue;

      result[column.name] = null;
    }

    return result;
  }

  async #transformObjectToApi(object: any): Promise<Schemas.DataInputRecord> {
    const schema = this.#schema.tables.find((table) => table.name === this.#table);
    if (!schema) throw new Error(`Table ${this.#table} not found in schema`);

    const result: Dictionary<any> = {};

    for (const [key, value] of Object.entries(object)) {
      // Ignore internal properties
      if (['xata_version', 'xata_createdat', 'xata_updatedat'].includes(key)) continue;

      const type = schema.columns.find((column) => column.name === key)?.type;

      switch (type) {
        case 'link': {
          result[key] = isObject(value) ? value[this.#primaryKey] : value;
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

export class RestRepository<Schema extends DatabaseSchema, TableName extends string, ObjectType>
  extends Query<Schema, TableName, ObjectType, SelectedPick<ObjectType, ['*']>>
  implements Repository<Schema, TableName, ObjectType>
{
  #table: string;
  #getFetchProps: () => ApiExtraProps;
  #db: SchemaPluginResult<any>;
  #schema: DatabaseSchema;
  #trace: TraceFunction;

  constructor(options: {
    table: string;
    db: SchemaPluginResult<any>;
    pluginOptions: XataPluginOptions;
    schema: DatabaseSchema;
  }) {
    super(
      null,
      { name: options.table, schema: options.schema.tables.find((table) => table.name === options.table) },
      {}
    );

    this.#table = options.table;
    this.#db = options.db;
    this.#schema = options.schema;
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

  async create<K extends SelectableColumn<ObjectType>>(
    object: NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async create(
    object: NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async create<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableDataWithoutNumeric<ObjectType>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async create(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: NewEditableDataWithoutNumeric<ObjectType>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async create<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async create(
    objects: Array<NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async create<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | (NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>)
      | Array<NewEditableDataWithoutNumeric<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    b?: NewEditableDataWithoutNumeric<ObjectType> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Readonly<SelectedPick<ObjectType, K[]>>[]
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Readonly<SelectedPick<ObjectType, ['*']>>[]
  > {
    return this.#trace('create', async () => {
      const ifVersion = parseIfVersion(b, c, undefined);

      // Create many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = await this.#insertRecords(a as any, { ifVersion, createOnly: true });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(ids as string[], columns);
        return result;
      }

      // Create one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a, b as EditableData<ObjectType>, columns, {
          createOnly: true,
          ifVersion
        });
      }

      // Create one record with id as property
      if (isObject(a) && isString((a as any).xata_id)) {
        if ((a as any).xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(b) ? b : undefined;
        return await this.#insertRecordWithId((a as any).xata_id, { ...(a as any), xata_id: undefined }, columns, {
          createOnly: true,
          ifVersion
        });
      }

      // Create one record without id
      if (isObject(a)) {
        const columns = isValidSelectableColumns(b) ? b : undefined;
        return this.#insertRecordWithoutId(a as any, columns);
      }

      throw new Error('Invalid arguments for create method');
    });
  }

  async #insertRecordWithoutId(object: EditableData<ObjectType>, columns: SelectableColumn<ObjectType>[] = ['*']) {
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

    return initObject(this.#db, this.#schema, this.#table, response, columns) as any;
  }

  async #insertRecordWithId(
    recordId: Identifier,
    object: EditableData<ObjectType>,
    columns: SelectableColumn<ObjectType>[] = ['*'],
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

    return initObject(this.#db, this.#schema, this.#table, response, columns) as any;
  }

  async #insertRecords(
    objects: EditableData<ObjectType>[],
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

  async read<K extends SelectableColumn<ObjectType>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns> | null>>;
  async read(id: string): Promise<Readonly<SelectedPick<ObjectType, ['*']> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async read(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns> | null>>;
  async read(object: Identifiable): Promise<Readonly<SelectedPick<ObjectType, ['*']> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    objects: Identifiable[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async read(objects: Identifiable[]): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async read<K extends SelectableColumn<ObjectType>>(
    a: Identifier | ReadonlyArray<Identifier> | Identifiable | Identifiable[],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>> | null>
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

          return initObject<ObjectType>(
            this.#db,
            this.#schema,
            this.#table,
            response,
            columns as SelectableColumn<ObjectType>[]
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

  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async readOrThrow(id: Identifier): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    ids: ReadonlyArray<Identifier>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async readOrThrow(ids: ReadonlyArray<Identifier>): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async readOrThrow(object: Identifiable): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Identifiable[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async readOrThrow(objects: Identifiable[]): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async readOrThrow<K extends SelectableColumn<ObjectType>>(
    a: Identifier | ReadonlyArray<Identifier> | Identifiable | Identifiable[],
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Readonly<SelectedPick<ObjectType, ['*']>>[]
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Readonly<SelectedPick<ObjectType, K[]>>[]
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

  async update<K extends SelectableColumn<ObjectType>>(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async update(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async update<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async update(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async update<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async update(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async update<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | (Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName])
      | Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    b?: Partial<NewEditableData<ObjectType>> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>> | null>
    | null
  > {
    return this.#trace('update', async () => {
      const ifVersion = parseIfVersion(b, c, undefined);

      // Update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        // TODO: Transaction API fails fast if one of the records is not found
        const existing = await this.read(a, ['xata_id'] as SelectableColumn<ObjectType>[]);
        const updates = a.filter((_item, index) => existing[index] !== null);

        await this.#updateRecords(updates as Array<Partial<EditableData<ObjectType>> & Identifiable>, {
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
          return await this.#updateRecordWithID(a, b as EditableData<ObjectType>, columns, { ifVersion });
        }

        // Update one record with id as property
        if (isObject(a) && isString((a as any).xata_id)) {
          const columns = isValidSelectableColumns(b) ? b : undefined;
          return await this.#updateRecordWithID((a as any).xata_id, { ...(a as any), xata_id: undefined }, columns, {
            ifVersion
          });
        }
      } catch (error: any) {
        if (error.status === 422) return null;
        throw error;
      }

      throw new Error('Invalid arguments for update method');
    });
  }

  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName],
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async updateOrThrow(
    object: Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async updateOrThrow(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Partial<NewEditableData<ObjectType>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async updateOrThrow(
    objects: Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async updateOrThrow<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | (Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName])
      | Array<Partial<NewEditableData<ObjectType>> & NewIdentifiable<Schema['tables']>[TableName]>,
    b?: Partial<NewEditableData<ObjectType>> | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
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
    recordId: Identifier,
    object: Partial<EditableData<ObjectType>>,
    columns: SelectableColumn<ObjectType>[] = ['*'],
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

      return initObject(this.#db, this.#schema, this.#table, response, columns) as any;
    } catch (e) {
      if (isObject(e) && e.status === 404) {
        return null;
      }

      throw e;
    }
  }

  async #updateRecords(
    objects: Array<Partial<EditableData<ObjectType>> & Identifiable>,
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

  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrUpdate(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrUpdate(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async createOrUpdate(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async createOrUpdate<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | NewEditableData<ObjectType>
      | NewEditableData<ObjectType>[],
    b?:
      | NewEditableData<ObjectType>
      | Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
      | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
  > {
    return this.#trace('createOrUpdate', async () => {
      const ifVersion = parseIfVersion(b, c, undefined);

      // Create or update many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        await this.#updateRecords(a as Array<Partial<EditableData<ObjectType>> & Identifiable>, {
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
        return await this.#upsertRecordWithID(a, b as EditableData<ObjectType>, columns, { ifVersion });
      }

      // Create or update one record with id as property
      if (isObject(a) && isString((a as any).xata_id)) {
        if ((a as any).xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#upsertRecordWithID((a as any).xata_id, { ...(a as any), xata_id: undefined }, columns, {
          ifVersion
        });
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as any, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined((a as any).xata_id)) {
        return await this.create(a as any, b as K[]);
      }

      throw new Error('Invalid arguments for createOrUpdate method');
    });
  }

  async #upsertRecordWithID(
    recordId: Identifier,
    object: Omit<EditableData<ObjectType>, 'xata_id'>,
    columns: SelectableColumn<ObjectType>[] = ['*'],
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

    return initObject(this.#db, this.#schema, this.#table, response, columns) as any;
  }

  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrReplace(
    object: NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]> | undefined,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async createOrReplace(
    id: NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]> | undefined,
    object: Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>[]>;
  async createOrReplace(
    objects: Array<NewEditableData<ObjectType> & Partial<NewIdentifiable<Schema['tables']>[TableName]>>
  ): Promise<Readonly<SelectedPick<ObjectType, ['*']>>[]>;
  async createOrReplace<K extends SelectableColumn<ObjectType>>(
    a:
      | NewIndentifierValue<NewIdentifiable<Schema['tables']>[TableName]>
      | NewEditableData<ObjectType>
      | NewEditableData<ObjectType>[]
      | undefined,
    b?:
      | NewEditableData<ObjectType>
      | Omit<NewEditableData<ObjectType>, NewIdentifierKey<NewIdentifiable<Schema['tables']>[TableName]>>
      | K[],
    c?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
  > {
    return this.#trace('createOrReplace', async () => {
      const ifVersion = parseIfVersion(b, c, undefined);

      // Create or replace many records
      if (Array.isArray(a)) {
        if (a.length === 0) return [];

        const ids = await this.#insertRecords(a as any, { ifVersion, createOnly: false });

        const columns = isValidSelectableColumns(b) ? b : (['*'] as K[]);

        // TODO: Transaction API does not support column projection
        const result = await this.read(ids as string[], columns);
        return result;
      }

      // Create or replace one record with id as param
      if (isString(a) && isObject(b)) {
        if (a === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId(a, b as EditableData<ObjectType>, columns, {
          createOnly: false,
          ifVersion
        });
      }

      // Create or replace one record with id as property
      if (isObject(a) && isString((a as any).xata_id)) {
        if ((a as any).xata_id === '') throw new Error("The id can't be empty");

        const columns = isValidSelectableColumns(c) ? c : undefined;
        return await this.#insertRecordWithId((a as any).xata_id, { ...(a as any), xata_id: undefined }, columns, {
          createOnly: false,
          ifVersion
        });
      }

      // Create with undefined id as param
      if (!isDefined(a) && isObject(b)) {
        return await this.create(b as any, c as K[]);
      }

      // Create with undefined id as property
      if (isObject(a) && !isDefined((a as any).xata_id)) {
        return await this.create(a as any, b as K[]);
      }

      throw new Error('Invalid arguments for createOrReplace method');
    });
  }

  async delete<K extends SelectableColumn<ObjectType>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async delete(object: Identifiable): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async delete<K extends SelectableColumn<ObjectType>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>> | null>;
  async delete(id: Identifier): Promise<Readonly<SelectedPick<ObjectType, ['*']>> | null>;
  async delete<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<EditableData<ObjectType>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async delete(
    objects: Array<Partial<EditableData<ObjectType>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async delete<K extends SelectableColumn<ObjectType>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>> | null>>;
  async delete(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>>;
  async delete<K extends SelectableColumn<ObjectType>>(
    a: Identifier | Identifiable | Array<Identifier | Identifiable>,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>> | null>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>> | null>
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

  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    object: Identifiable,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async deleteOrThrow(object: Identifiable): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    id: Identifier,
    columns: K[]
  ): Promise<Readonly<SelectedPick<ObjectType, typeof columns>>>;
  async deleteOrThrow(id: Identifier): Promise<Readonly<SelectedPick<ObjectType, ['*']>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Array<Partial<EditableData<ObjectType>> & Identifiable>,
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async deleteOrThrow(
    objects: Array<Partial<EditableData<ObjectType>> & Identifiable>
  ): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    objects: Identifier[],
    columns: K[]
  ): Promise<Array<Readonly<SelectedPick<ObjectType, typeof columns>>>>;
  async deleteOrThrow(objects: Identifier[]): Promise<Array<Readonly<SelectedPick<ObjectType, ['*']>>>>;
  async deleteOrThrow<K extends SelectableColumn<ObjectType>>(
    a: Identifier | Identifiable | Array<Identifier | Identifiable>,
    b?: K[]
  ): Promise<
    | Readonly<SelectedPick<ObjectType, ['*']>>
    | Array<Readonly<SelectedPick<ObjectType, ['*']>>>
    | Readonly<SelectedPick<ObjectType, K[]>>
    | Array<Readonly<SelectedPick<ObjectType, K[]>>>
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

  async #deleteRecord(recordId: Identifier, columns: SelectableColumn<ObjectType>[] = ['*']) {
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

      return initObject(this.#db, this.#schema, this.#table, response, columns) as any;
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
      filter?: Filter<ObjectType>;
      boosters?: Boosters<ObjectType>[];
      page?: SearchPageConfig;
      target?: TargetColumn<ObjectType>[];
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

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) => initObject(this.#db, this.#schema, this.#table, item, ['*'])) as any,
        totalCount
      };
    });
  }

  async vectorSearch<F extends ColumnsByValue<ObjectType, number[]>>(
    column: F,
    query: number[],
    options?:
      | {
          similarityFunction?: string | undefined;
          size?: number | undefined;
          filter?: Filter<ObjectType> | undefined;
        }
      | undefined
  ): Promise<{ records: SearchXataRecord<SelectedPick<ObjectType, ['*']>>[] } & TotalCount> {
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

      // TODO - Column selection not supported by search endpoint yet
      return {
        records: records.map((item) => initObject(this.#db, this.#schema, this.#table, item, ['*'])),
        totalCount
      } as any;
    });
  }

  async aggregate<Expression extends Dictionary<AggregationExpression<ObjectType>>>(
    aggs?: Expression,
    filter?: Filter<ObjectType>
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

  async query<Result extends XataRecord>(
    query: Query<Schema, TableName, ObjectType, Result>
  ): Promise<Page<Schema, TableName, ObjectType, Result>> {
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

      const records = objects.map((record) =>
        initObject<Result>(
          this.#db,
          this.#schema,
          this.#table,
          record,
          (data.columns as SelectableColumn<Result>[]) ?? ['*']
        )
      );

      return new Page<Schema, TableName, ObjectType, Result>(query, meta, records);
    });
  }

  async summarizeTable<Result extends XataRecord>(
    query: Query<Schema, TableName, ObjectType, Result>,
    summaries?: Dictionary<SummarizeExpression<ObjectType>>,
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
          columns: data.columns as SelectableColumn<ObjectType>[],
          consistency: data.consistency,
          page: data.pagination?.size !== undefined ? { size: data.pagination?.size } : undefined,
          summaries,
          summariesFilter
        },
        ...this.#getFetchProps()
      });

      return {
        ...result,
        summaries: result.summaries.map((summary) =>
          initObject(this.#db, this.#schema, this.#table, summary, data.columns ?? [])
        )
      };
    });
  }

  ask(question: string, options?: AskOptions<ObjectType> & { onMessage?: (message: AskResult) => void }): any {
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

  async #transformObjectToApi(object: any): Promise<Schemas.DataInputRecord> {
    const schema = this.#schema.tables.find((table) => table.name === this.#table);
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
  repo: KyselyRepository<any, any, any>,
  schemaTables: DatabaseSchema,
  primaryKey: string,
  table: string,
  object: Record<string, any>,
  selectedColumns: SelectableColumn<T>[] | SelectableColumnWithObjectNotation<T>[]
) => {
  const data: Dictionary<unknown> = {};
  Object.assign(data, { ...object });

  const { columns } = schemaTables.tables.find(({ name }) => name === table) ?? {};
  if (!columns) console.error(`Table ${table} not found in schema`);

  for (const column of columns ?? []) {
    // Ignore columns not selected
    if (!isValidColumn(selectedColumns, column)) continue;

    const value = data[column.name];

    switch (column.type) {
      case 'datetime': {
        const date = value !== undefined && value !== null ? new Date(value as string) : null;

        if (date !== null && isNaN(date.getTime())) {
          console.error(`Failed to parse date ${value} for field ${column.name}`);
        } else {
          data[column.name] = date;
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
    return repo.read(record[primaryKey] as any, columns);
  };

  record.update = async function (data: any, b?: any) {
    const columns = isValidSelectableColumns(b) ? b : ['*'];
    // @ts-ignore
    return repo.update(record[primaryKey], data, columns);
  };

  record.replace = async function (data: any, b?: any) {
    const validColumns = isValidSelectableColumns(b) ? b : ['*'];
    return repo.createOrReplace(record[primaryKey] as any, data, validColumns);
  };

  record.delete = async function () {
    return repo.delete(record[primaryKey] as any);
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
  db: Record<string, Repository<any, any, any>>,
  schema: DatabaseSchema,
  table: string,
  object: Record<string, any>,
  selectedColumns: SelectableColumn<T>[] | SelectableColumnWithObjectNotation<T>[]
) => {
  const data: Dictionary<unknown> = {};
  Object.assign(data, { ...object });

  const { columns } = schema.tables.find(({ name }) => name === table) ?? {};
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
    return db[table].read(record['xata_id'] as any, columns);
  };

  record.update = function (data: any, b?: any, c?: any) {
    const columns = isValidSelectableColumns(b) ? b : ['*'];
    const ifVersion = parseIfVersion(b, c);

    // @ts-ignore
    return db[table].update(record['xata_id'] as any, data, columns, { ifVersion });
  };

  record.replace = function (data: any, b?: any, c?: any) {
    const columns = isValidSelectableColumns(b) ? b : ['*'];
    const ifVersion = parseIfVersion(b, c);

    return db[table].createOrReplace(record['xata_id'] as any, data, columns, { ifVersion });
  };

  record.delete = function () {
    return db[table].delete(record['xata_id'] as any);
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

function extractIdKysely(value: any, primaryKey: string) {
  if (isStringOrNumber(value)) return value as any;
  if (isObject(value) && isStringOrNumber(value[primaryKey])) return value[primaryKey] as any;
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

const operatorMap: { [operator: string]: BinaryOperatorExpression } = {
  $increment: '+',
  $decrement: '-',
  $multiply: '*',
  $divide: '/'
};

const operatorNames = Object.keys(operatorMap);

type OperatorMap = keyof typeof operatorMap;
type NumericOperations = { field: string; operator: OperatorMap; value: number };

const removeKeysFromRecord = ({ record, path }: { path: string[]; record: { [k: string]: any } }) => {
  for (const key of path) {
    delete record[key];
  }
};

const extractNumericOperations = ({ numericFilters }: { numericFilters: { [key: string]: any } }) => {
  const acc: NumericOperations[] = [];
  const traverse = ({ current, path }: { current: { [key: string]: any } | string | number; path: string[] }) => {
    if (typeof current === 'number' && path.some((r) => operatorNames.includes(r))) {
      acc.push({
        field: path[path.length - 2],
        operator: path[path.length - 1],
        value: current
      });
      removeKeysFromRecord({ record: numericFilters, path });
      path.pop();
      path.pop();
    }
    if (isObject(current)) {
      for (const key in current) {
        path.push(key);
        traverse({ current: (current as any)[key], path });
      }
    }
  };
  traverse({ current: numericFilters, path: [] });
  return acc;
};

export const columnSelectionObject = (col: string[]) => {
  const result: ColumnSelectionObject = { links: {}, regular: [] };
  const traverse = (columnPath: string, path: string[]) => {
    const [table, ...rest] = columnPath.split('.');
    if (!atPath(result, path)['links']) {
      atPath(result, path)['links'] = {};
    }
    if (!atPath(result, path)['regular']) {
      atPath(result, path)['regular'] = [];
    }

    if (rest.length > 0) {
      traverse(rest.join('.'), [...path, 'links', table]);
    } else {
      atPath(result, path)['regular'].push(table);
    }
  };

  col.forEach((c) => {
    traverse(c, []);
  });
  return result;
};

const selectAllColumns = (columns: SelectableColumn<any>[] = ['*']) => {
  return !columns || (columns && columns.length > 0 && columns[0] === '*') || (columns && columns.length === 0);
};

export const generateSelectStatement = ({
  filter,
  columns,
  stmt,
  schema,
  tableName,
  primaryKey,
  columnData,
  db
}: {
  filter: Filter<any>;
  columnData: Schemas.Column[];
  columns: any[];
  stmt: SelectQueryBuilder<Model<any>, string, {}>;
  schema: Schema;
  tableName: string;
  primaryKey: string;
  db: KyselyPluginResult<Record<string, XataRecord<XataRecord<any>>>>;
}) => {
  const columnsSelected = columnSelectionObject(columns ?? []);
  const visited: Set<string> = new Set();

  if (selectAllColumns(columns as any)) {
    stmt = stmt.selectAll();
    if (filter) {
      const topLevelFilters = relevantFilters(filter, true, tableName, visited);
      if (topLevelFilters) {
        stmt = stmt.where(
          (eb) =>
            filterToKysely({ value: { [tableName]: topLevelFilters }, path: [] })(
              eb,
              columnData as any,
              tableName
            ) as any
        );
      }
    }
  } else {
    // TODO separate selection and filtering
    const select = stmt.select((eb) => {
      const selection = (
        fields: Selection<any, any, any>,
        eb: ExpressionBuilder<any, any>,
        lastParent: string
      ): SelectExpression<any, any>[] => {
        const regularFields = fields.regular.includes('*')
          ? [sql.raw<string>('*')]
          : fields.regular.includes(primaryKey)
          ? fields.regular
          : [primaryKey, ...fields.regular];
        if (Object.keys(fields.links).length > 0) {
          const links: (string | RawBuilder<string> | AliasedRawBuilder<{ [x: string]: any } | null, string>)[] = [
            ...regularFields
          ];
          for (const key in fields.links) {
            const table = schema.tables?.find((table) => table.name === lastParent);
            const fk: BranchSchema['tables'][number]['foreignKeys'][number] | null = table
              ? (Object.values((table as any)?.foreignKeys ?? {})?.find((fk) =>
                  (fk as any).columns.includes(key)
                ) as any)
              : null;
            if (!fk) continue;
            const selectedColumns = selection(fields.links[key], eb, fk?.referencedTable);

            const filters = relevantFilters(filter, false, key, visited);
            const conditions = filters
              ? (filterToKysely({ value: filters, path: [] })(eb, columnData, tableName) as any)
              : null;
            const stmt = eb
              .selectFrom(fk.referencedTable)
              .select(selectedColumns)
              .where(fk.referencedColumns[0], '=', eb.ref(`${lastParent}.${fk.columns[0]}`));
            const linkObject = conditions
              ? jsonObjectFromCustom(stmt.where(conditions)).as(`${fk.columns[0]}`)
              : jsonObjectFrom(stmt).as(`${fk.columns[0]}`);

            links.push(linkObject);
          }

          return links as SelectExpression<any, any>[];
        }

        // TODO maybe add regular fields filters on here instead of below
        return regularFields as SelectExpression<any, any>[];
      };
      return selection(columnsSelected, eb, tableName);
    });

    stmt = select;

    if (filter) {
      const topLevelFilters = relevantFilters(filter, true, tableName, visited);
      if (topLevelFilters) {
        stmt = stmt.where(
          (eb) =>
            filterToKysely({ value: { [tableName]: topLevelFilters }, path: [] })(
              eb,
              columnData as any,
              tableName
            ) as any
        );
      }
    }
    const linkKeys = Object.keys(columnsSelected.links);
    const visited2: Set<string> = new Set();
    if (linkKeys.length > 0) {
      const linkFilters = linkKeys.filter((link) => relevantFilters(filter, false, link, visited2));
      if (linkFilters.length > 0) {
        stmt = db
          .selectFrom(sql`${stmt}`.as('tmp'))
          .selectAll()
          .where((eb) =>
            eb.and([
              ...linkFilters.map((link) => {
                return sql.raw(`"tmp"."${link}" is not null`);
              })
            ])
          );
      }
    }
  }

  return stmt;
};

export function jsonObjectFromCustom<O>(expr: Expression<O>): RawBuilder<Simplify<O> | null> {
  return sql`(select to_json(obj) from ${expr} as obj where obj is not null)`;
}
