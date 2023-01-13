import { BaseData, EditableData, SelectableColumn, SelectedPick, XataRecord } from '../schema';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';

export type TransactionOperation<Schemas extends Record<string, BaseData>, Tables extends StringKeys<Schemas>> =
  | {
      insert: Values<{
        [Model in GetArrayInnerType<NonNullable<Tables[]>>]: { table: Model } & InsertTransactionOperation<
          Schemas[Model] & XataRecord
        >;
      }>;
    }
  | {
      update: Values<{
        [Model in GetArrayInnerType<NonNullable<Tables[]>>]: { table: Model } & UpdateTransactionOperation<
          Schemas[Model] & XataRecord
        >;
      }>;
    }
  | {
      delete: Values<{
        [Model in GetArrayInnerType<NonNullable<Tables[]>>]: { table: Model } & DeleteTransactionOperation<
          Schemas[Model] & XataRecord
        >;
      }>;
    };

export type InsertTransactionOperation<O extends XataRecord> = {
  record: Partial<EditableData<O>>;
  ifVersion?: number;
  createOnly?: boolean;
  columns?: SelectableColumn<O>[];
};

export type UpdateTransactionOperation<O extends XataRecord> = {
  id: string;
  fields: Partial<EditableData<O>>;
  ifVersion?: number;
  upsert?: boolean;
  columns?: SelectableColumn<O>[];
};

export type DeleteTransactionOperation<O extends XataRecord> = {
  id: string;
  columns?: SelectableColumn<O>[];
};

type TransactionOperationSingleResult<
  Schema extends Record<string, BaseData>,
  Table extends StringKeys<Schema>,
  Operation extends TransactionOperation<Schema, Table>
> = Operation extends { insert: { table: Table; record: { id: infer Id } } }
  ? // TODO FIXME DO NOT MERGE: SelectedPick infer Columns :)
    { operation: 'insert'; id: Id; rows: number; fields: SelectedPick<Schema & XataRecord, ['*']> }
  : Operation extends { insert: { table: Table } }
  ? { operation: 'insert'; id: string; rows: number; fields: SelectedPick<Schema & XataRecord, ['*']> }
  : Operation extends { update: { table: Table; id: infer Id } }
  ? { operation: 'update'; id: Id; rows: number; fields: SelectedPick<Schema & XataRecord, ['*']> }
  : Operation extends { delete: { table: Table } }
  ? { operation: 'delete'; rows: number; fields: SelectedPick<Schema & XataRecord, ['*']> }
  : never;

type TransactionOperationResults<
  Schema extends Record<string, BaseData>,
  Table extends StringKeys<Schema>,
  Operations extends TransactionOperation<Schema, Table>[]
> = Operations extends [infer Head, ...infer Rest]
  ? Head extends TransactionOperation<Schema, Table>
    ? Rest extends TransactionOperation<Schema, Table>[]
      ? [TransactionOperationSingleResult<Schema, Table, Head>, ...TransactionOperationResults<Schema, Table, Rest>]
      : never
    : never
  : []; // Default to empty array, if we use never, the array inference will fail

export type TransactionResults<
  Schema extends Record<string, BaseData>,
  Table extends StringKeys<Schema>,
  Operations extends TransactionOperation<Schema, Table>[]
> = {
  results: TransactionOperationResults<Schema, Table, Operations>;
};
