import { isObject, isString } from '../util/lang';
import { SelectableColumn, SelectedPick } from './selection';

/**
 * Represents an identifiable record from the database.
 */
export interface Identifiable {
  /**
   * Unique id of this record.
   */
  id: string;
}

export interface BaseData {
  [key: string]: any;
}

/**
 * Represents a persisted record from the database.
 */
export interface XataRecord<OriginalRecord extends XataRecord<any> = XataRecord<any>> extends Identifiable {
  /**
   * Get metadata of this record.
   */
  getMetadata(): XataRecordMetadata;

  /**
   * Get an object representation of this record.
   */
  toObject(): JSONData<OriginalRecord>;

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

export type XataRecordMetadata = {
  /**
   * Number that is increased every time the record is updated.
   */
  version: number;
  /*
   * Encoding/Decoding errors
   */
  warnings?: string[];
};

export function isIdentifiable(x: any): x is Identifiable & Record<string, unknown> {
  return isObject(x) && isString((x as Partial<Identifiable>)?.id);
}

export function isXataRecord(x: any): x is XataRecord & Record<string, unknown> {
  const record = x as XataRecord & Record<string, unknown>;
  const metadata = record?.getMetadata();

  return isIdentifiable(x) && isObject(metadata) && typeof metadata.version === 'number';
}

type EditableDataFields<T> = T extends XataRecord
  ? { id: string } | string
  : NonNullable<T> extends XataRecord
  ? { id: string } | string | null | undefined
  : T extends Date
  ? string | Date
  : NonNullable<T> extends Date
  ? string | Date | null | undefined
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

type JSONDataFields<T> = T extends XataRecord
  ? string
  : NonNullable<T> extends XataRecord
  ? string | null | undefined
  : T extends Date
  ? string
  : NonNullable<T> extends Date
  ? string | null | undefined
  : T;

export type JSONData<O> = Identifiable &
  Partial<
    Omit<
      {
        [K in keyof O]: JSONDataFields<O[K]>;
      },
      keyof XataRecord
    >
  >;
