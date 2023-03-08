import { Schemas } from '@xata.io/client';
import z from 'zod';
import { columnSchema } from '../schema.js';

const addTable = z.object({
  addTable: z.object({ table: z.string() })
}) satisfies z.ZodType<{ addTable: Schemas.TableOpAdd }>;

const removeTable = z.object({
  removeTable: z.object({ table: z.string() })
}) satisfies z.ZodType<{ removeTable: Schemas.TableOpRemove }>;

const renameTable = z.object({
  renameTable: z.object({
    oldName: z.string(),
    newName: z.string()
  })
}) satisfies z.ZodType<{ renameTable: Schemas.TableOpRename }>;

const migrationTableOp = z.union([addTable, removeTable, renameTable]) satisfies z.ZodType<Schemas.MigrationTableOp>;

const addColumn = z.object({
  addColumn: z.object({ table: z.string(), column: columnSchema })
}) satisfies z.ZodType<{ addColumn: Schemas.ColumnOpAdd }>;

const removeColumn = z.object({
  removeColumn: z.object({ table: z.string(), column: z.string() })
}) satisfies z.ZodType<{ removeColumn: Schemas.ColumnOpRemove }>;

const renameColumn = z.object({
  renameColumn: z.object({ table: z.string(), oldName: z.string(), newName: z.string() })
}) satisfies z.ZodType<{ renameColumn: Schemas.ColumnOpRename }>;

const migrationColumnOp = z.union([
  addColumn,
  removeColumn,
  renameColumn
]) satisfies z.ZodType<Schemas.MigrationColumnOp>;

const migrationOperation = z.union([migrationTableOp, migrationColumnOp]) satisfies z.ZodType<Schemas.MigrationOp>;

export const migrationFile = z.object({
  id: z.string(),
  parent: z.string(),
  checksum: z.string(),
  operations: z.array(migrationOperation)
});

export type MigrationFile = z.infer<typeof migrationFile>;
