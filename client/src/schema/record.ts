import { Selectable } from './selection';

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
export interface XataRecord extends Identifiable {
  /**
   * Metadata of this record.
   */
  xata: {
    /**
     * Number that is increased every time the record is updated.
     */
    version: number;
  };

  /**
   * Retrieves a refreshed copy of the current record from the database.
   */
  read(): Promise<this>;

  /**
   * Performs a partial update of the current record. On success a new object is
   * returned and the current object is not mutated.
   * @param data The columns and their values that have to be updated.
   * @returns A new record containing the latest values for all the columns of the current record.
   */
  update(data: Partial<Selectable<this>>): Promise<this>;

  /**
   * Performs a deletion of the current record in the database.
   *
   * @throws If the record was already deleted or if an error happened while performing the deletion.
   */
  delete(): Promise<void>;
}

// Used to avoid infinite circular dependendencies in type instantiation
export type MAX_LINK_RECURSION = 10;
export type Link<T, RecursivePath extends any[] = []> = RecursivePath['length'] extends MAX_LINK_RECURSION
  ? LinkTooDeep<T>
  : {
      [K in keyof T]: NonNullable<T[K]> extends XataRecord ? Link<T[K], [...RecursivePath, T[K]]> : T[K];
    };

type LinkTooDeep<T> = {
  [K in keyof T]: K extends keyof XataRecord ? T[K] : never;
};

export function isIdentifiable(x: any): x is Identifiable & Record<string, unknown> {
  return typeof x === 'object' && typeof x?.id === 'string';
}

export function isXataRecord(x: any): x is XataRecord & Record<string, unknown> {
  return (
    isIdentifiable(x) && typeof x?.xata === 'object' && typeof (x?.xata as XataRecord['xata'])?.version === 'number'
  );
}
