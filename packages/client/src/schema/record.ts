import { isObject, isString } from '../util/lang';
import { ExclusiveOr } from '../util/types';
import { XataArrayFile, XataFile } from './files';
import { SelectableColumn, SelectedPick } from './selection';

export const RecordColumnTypes = [
  'bool',
  'int',
  'float',
  'string',
  'text',
  'email',
  'multiple',
  'link',
  'datetime',
  'vector',
  'file[]',
  'file',
  'json'
] as const;

export type Identifier = string;

/**
 * Represents an identifiable record from the database.
 */
export interface Identifiable {
  /**
   * Unique id of this record.
   */
  xata_id: Identifier;
}

export interface BaseData {
  [key: string]: any;
}

/**
 * Represents a persisted record from the database.
 */
export interface XataRecord<OriginalRecord extends XataRecord<any> = XataRecord<any>> extends Identifiable {
  /**
   * Get an object representation of this record.
   */
  toSerializable(): JSONData<OriginalRecord>;

  /**
   * Get a string representation of this record.
   */
  toString(): string;

  /**
   * Retrieves a refreshed copy of the current record from the database.
   * @param columns The columns to retrieve. If not specified, all first level properties are retrieved.
   * @returns The persisted record with the selected columns, null if not found.
   */
  read<K extends SelectableColumn<OriginalRecord>>(
    columns: K[]
  ): Promise<Readonly<SelectedPick<OriginalRecord, typeof columns>> | null>;

  /**
   * Retrieves a refreshed copy of the current record from the database.
   * @returns The persisted record with all first level properties, null if not found.
   */
  read(): Promise<Readonly<SelectedPick<OriginalRecord, ['*']>> | null>;

  /**
   * Performs a partial update of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @param columns The columns to retrieve. If not specified, all first level properties are retrieved.
   * @returns The persisted record with the selected columns, null if not found.
   */
  update<K extends SelectableColumn<OriginalRecord>>(
    partialUpdate: Partial<EditableData<OriginalRecord>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<OriginalRecord, typeof columns>> | null>;

  /**
   * Performs a partial update of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @returns The persisted record with all first level properties, null if not found.
   */
  update(
    partialUpdate: Partial<EditableData<OriginalRecord>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<OriginalRecord, ['*']>> | null>;

  /**
   * Performs a replace of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @param columns The columns to retrieve. If not specified, all first level properties are retrieved.
   * @returns The persisted record with the selected columns, null if not found.
   */
  replace<K extends SelectableColumn<OriginalRecord>>(
    object: Partial<EditableData<OriginalRecord>>,
    columns: K[],
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<OriginalRecord, typeof columns>> | null>;

  /**
   * Performs a replace of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @returns The persisted record with all first level properties, null if not found.
   */
  replace(
    object: Partial<EditableData<OriginalRecord>>,
    options?: { ifVersion?: number }
  ): Promise<Readonly<SelectedPick<OriginalRecord, ['*']>> | null>;

  /**
   * Performs a deletion of the current record in the database.
   * @param columns The columns to retrieve. If not specified, all first level properties are retrieved.
   * @returns The deleted record, null if not found.
   */
  delete<K extends SelectableColumn<OriginalRecord>>(
    columns: K[]
  ): Promise<Readonly<SelectedPick<OriginalRecord, typeof columns>> | null>;

  /**
   * Performs a deletion of the current record in the database.
   * @returns The deleted record, null if not found.

   */
  delete(): Promise<Readonly<SelectedPick<OriginalRecord, ['*']>> | null>;
}

export type Link<Record extends XataRecord> = XataRecord<Record>;

export function isIdentifiable(x: any): x is Identifiable & Record<string, unknown> {
  return isObject(x) && isString(x?.xata_id);
}

export type NumericOperator = ExclusiveOr<
  { $increment?: number },
  ExclusiveOr<{ $decrement?: number }, ExclusiveOr<{ $multiply?: number }, { $divide?: number }>>
>;

export type InputXataFile = Partial<XataArrayFile> | Promise<Partial<XataArrayFile>>;

type EditableDataFields<T> = T extends XataRecord
  ? { xata_id: Identifier } | Identifier
  : NonNullable<T> extends XataRecord
  ? { xata_id: Identifier } | Identifier | null | undefined
  : T extends Date
  ? string | Date
  : NonNullable<T> extends Date
  ? string | Date | null | undefined
  : T extends XataFile
  ? InputXataFile
  : T extends XataFile[]
  ? InputXataFile[]
  : T extends number
  ? number | NumericOperator
  : T;

export type EditableData<O extends XataRecord> = Identifiable &
  Partial<
    Omit<
      {
        [K in keyof O]: EditableDataFields<O[K]>;
      },
      keyof XataRecord
    >
  >;

type JSONDataFile = {
  [K in keyof XataFile]: XataFile[K] extends Function ? never : XataFile[K];
};

type JSONDataFields<T> = T extends null | undefined | void
  ? null | undefined
  : T extends XataFile
  ? JSONDataFile
  : NonNullable<T> extends XataFile
  ? JSONDataFile | null | undefined
  : T extends XataRecord
  ? JSONData<T>
  : NonNullable<T> extends XataRecord
  ? JSONData<T> | null | undefined
  : T extends Date
  ? string
  : NonNullable<T> extends Date
  ? string | null | undefined
  : T;

type JSONDataBase = Identifiable & {
  /**
   * Timestamp when the record was created.
   */
  xata_createdat: string;
  /**
   * Timestamp when the record was last updated.
   */
  xata_updatedat: string;
  /**
   * Number that is increased every time the record is updated.
   */
  xata_version: number;
};

export type JSONData<O> = JSONDataBase &
  Partial<
    Omit<
      {
        [K in keyof O]: JSONDataFields<O[K]>;
      },
      keyof XataRecord
    >
  >;
