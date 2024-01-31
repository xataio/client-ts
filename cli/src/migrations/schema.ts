import { Schemas } from '@xata.io/client';
import { columnSchema } from '@xata.io/codegen';
import z from 'zod';

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
  title: z.string().optional(),
  message: z.string().optional(),
  parentID: z.string().optional(),
  checksum: z.string(),
  operations: z.array(migrationOperation)
}) satisfies z.ZodType<Schemas.MigrationObject>;

export const pgRollMigrationsFile = z.object({
  name: z.string(),
  migration: z.string(),
  startedAt: z.string(),
  parent: z.string().optional(),
  done: z.boolean(),
  migrationType: z.enum(['pgroll', 'inferred']) satisfies z.ZodType<Schemas.PgRollMigrationType>
}) satisfies z.ZodType<Schemas.PgRollMigrationHistoryItem>;

export const pgRollMigrationHistoryObject = z.object({
  name: z.string(),
  operations: z.array(z.any())
});
