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
export interface XataRecord<ExtraMetadata extends Record<string, unknown> = Record<string, unknown>>
  extends Identifiable {
  /**
   * Get metadata of this record.
   */
  getMetadata(): XataRecordMetadata & ExtraMetadata;

  /**
   * Retrieves a refreshed copy of the current record from the database.
   */
  read(): Promise<Readonly<SelectedPick<this, ['*']>> | null>;

  /**
   * Retrieves a refreshed copy of the current record from the database.
   * @param columns The columns to retrieve. If not specified, all first level properties are retrieved.
   */
  read<K extends SelectableColumn<this>>(columns: K[]): Promise<Readonly<SelectedPick<this, typeof columns>> | null>;

  /**
   * Performs a partial update of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @returns A new record containing the latest values for all the columns of the current record.
   */
  update(
    partialUpdate: Partial<EditableData<Omit<this, keyof XataRecord>>>
  ): Promise<Readonly<SelectedPick<this, ['*']>>>;

  /**
   * Performs a partial update of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @param columns The columns to retrieve. If not specified, all first level properties are retrieved.
   * @returns A new record containing the latest values for all the columns of the current record.
   */
  update<K extends SelectableColumn<this>>(
    partialUpdate: Partial<EditableData<Omit<this, keyof XataRecord>>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<this, typeof columns>>>;

  /**
   * Performs a deletion of the current record in the database.
   *
   * @throws If the record was already deleted or if an error happened while performing the deletion.
   */
  delete(): Promise<void>;
}

export type Link<Record extends XataRecord> = Omit<XataRecord, 'read' | 'update'> & {
  /**
   * Retrieves a refreshed copy of the current record from the database.
   */
  read(): Promise<Readonly<SelectedPick<Record, ['*']>> | null>;

  /**
   * Retrieves a refreshed copy of the current record from the database.
   */
  read<K extends SelectableColumn<Record>>(
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>> | null>;

  /**
   * Performs a partial update of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @returns A new record containing the latest values for all the columns of the current record.
   */
  update(
    partialUpdate: Partial<EditableData<Omit<Record, keyof XataRecord>>>
  ): Promise<Readonly<SelectedPick<Record, ['*']>>>;

  /**
   * Performs a partial update of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param partialUpdate The columns and their values that have to be updated.
   * @returns A new record containing the latest values for all the columns of the current record.
   */
  update<K extends SelectableColumn<Record>>(
    partialUpdate: Partial<EditableData<Omit<Record, keyof XataRecord>>>,
    columns: K[]
  ): Promise<Readonly<SelectedPick<Record, typeof columns>>>;

  /**
   * Performs a deletion of the current record in the database.
   *
   * @throws If the record was already deleted or if an error happened while performing the deletion.
   */
  delete(): Promise<void>;
};

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

export type EditableData<O extends BaseData> = {
  [K in keyof O]: O[K] extends XataRecord
    ? { id: string } | string
    : NonNullable<O[K]> extends XataRecord
    ? { id: string } | string | null | undefined
    : O[K];
};
