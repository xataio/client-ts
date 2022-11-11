import { BaseData } from '../schema';
import { StringKeys } from '../util/types';

export type TransactionOperation<Schema extends Record<string, BaseData>, Table extends StringKeys<Schema>> =
  | InsertTransactionOperation<Schema, Table>
  | UpdateTransactionOperation<Schema, Table>
  | DeleteTransactionOperation<Schema, Table>;

export type InsertTransactionOperation<Schema extends Record<string, BaseData>, Table extends StringKeys<Schema>> = {
  insert: { table: Table; record: Partial<Schema[Table]>; ifVersion?: number; createOnly?: boolean };
};

export type UpdateTransactionOperation<Schema extends Record<string, BaseData>, Table extends StringKeys<Schema>> = {
  update: { table: Table; id: string; fields: Partial<Schema[Table]>; ifVersion?: number; upsert?: boolean };
};

export type DeleteTransactionOperation<Schema extends Record<string, BaseData>, Table extends StringKeys<Schema>> = {
  delete: { table: Table; id: string };
};

type TransactionOperationSingleResult<
  Schema extends Record<string, BaseData>,
  Table extends StringKeys<Schema>,
  Operation extends TransactionOperation<Schema, Table>
> = Operation extends InsertTransactionOperation<Schema, Table>
  ? { operation: 'insert'; id: string; rows: number }
  : Operation extends UpdateTransactionOperation<Schema, Table>
  ? { operation: 'update'; id: string; rows: number }
  : Operation extends DeleteTransactionOperation<Schema, Table>
  ? { operation: 'delete'; rows: number }
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
