import { z } from 'zod';

export type CheckConstraint = z.infer<typeof CheckConstraintDefinition>;

export const CheckConstraintDefinition = z.object({
  constraint: z.string(),
  name: z.string()
});

export type ForeignKeyReference = z.infer<typeof ForeignKeyReferenceDefinition>;

export const ForeignKeyReferenceDefinition = z.object({
  column: z.string(),
  name: z.string(),
  table: z.string()
});

export type Column = z.infer<typeof ColumnDefinition>;

export const ColumnDefinition = z.object({
  check: CheckConstraintDefinition.optional(),
  default: z.string().optional(),
  name: z.string(),
  nullable: z.boolean(),
  pk: z.boolean(),
  references: ForeignKeyReferenceDefinition.optional(),
  type: z.string(),
  unique: z.boolean()
});

export type OpAddColumn = z.infer<typeof OpAddColumnDefinition>;

export const OpAddColumnDefinition = z.object({
  column: ColumnDefinition,
  table: z.string(),
  up: z.string().optional()
});

export type UniqueConstraint = z.infer<typeof UniqueConstraintDefinition>;

export const UniqueConstraintDefinition = z.object({ name: z.string() });

export type OpAlterColumn = z.infer<typeof OpAlterColumnDefinition>;

export const OpAlterColumnDefinition = z.object({
  check: CheckConstraintDefinition.optional(),
  column: z.string(),
  down: z.string(),
  name: z.string(),
  nullable: z.boolean().optional(),
  references: ForeignKeyReferenceDefinition.optional(),
  table: z.string(),
  type: z.string(),
  unique: UniqueConstraintDefinition.optional(),
  up: z.string()
});

export type OpCreateIndex = z.infer<typeof OpCreateIndexDefinition>;

export const OpCreateIndexDefinition = z.object({
  columns: z.array(z.string()),
  name: z.string(),
  table: z.string()
});

export type OpCreateTable = z.infer<typeof OpCreateTableDefinition>;

export const OpCreateTableDefinition = z.object({
  columns: z.array(ColumnDefinition),
  name: z.string()
});

export type OpDropColumn = z.infer<typeof OpDropColumnDefinition>;

export const OpDropColumnDefinition = z.object({
  column: z.string(),
  down: z.string().optional(),
  table: z.string()
});

export type OpDropConstraint = z.infer<typeof OpDropConstraintDefinition>;

export const OpDropConstraintDefinition = z.object({
  column: z.string(),
  down: z.string(),
  name: z.string(),
  table: z.string(),
  up: z.string()
});

export type OpDropIndex = z.infer<typeof OpDropIndexDefinition>;

export const OpDropIndexDefinition = z.object({ name: z.string() });

export type OpDropTable = z.infer<typeof OpDropTableDefinition>;

export const OpDropTableDefinition = z.object({ name: z.string() });

export type OpRawSQL = z.infer<typeof OpRawSQLDefinition>;

export const OpRawSQLDefinition = z.object({
  down: z.string().optional(),
  up: z.string()
});

export type OpRenameTable = z.infer<typeof OpRenameTableDefinition>;

export const OpRenameTableDefinition = z.object({
  from: z.string(),
  to: z.string()
});

export type ReplicaIdentity = z.infer<typeof ReplicaIdentityDefinition>;

export const ReplicaIdentityDefinition = z.object({
  index: z.string(),
  type: z.string()
});

export type OpSetReplicaIdentity = z.infer<typeof OpSetReplicaIdentityDefinition>;

export const OpSetReplicaIdentityDefinition = z.object({
  identity: ReplicaIdentityDefinition,
  table: z.string()
});

export type PgRollOperation = z.infer<typeof PgRollOperationDefinition>;

export const PgRollOperationDefinition = z.union([
  z.object({ add_column: OpAddColumnDefinition }),
  z.object({ alter_column: OpAlterColumnDefinition }),
  z.object({ create_index: OpCreateIndexDefinition }),
  z.object({ create_table: OpCreateTableDefinition }),
  z.object({ drop_column: OpDropColumnDefinition }),
  z.object({ drop_constraint: OpDropConstraintDefinition }),
  z.object({ drop_index: OpDropIndexDefinition }),
  z.object({ drop_table: OpDropTableDefinition }),
  z.object({ raw_sql: OpRawSQLDefinition }),
  z.object({ rename_table: OpRenameTableDefinition }),
  z.object({ set_replica_identity: OpSetReplicaIdentityDefinition })
]);

export type PgRollOperations = z.infer<typeof PgRollOperationsDefinition>;

export const PgRollOperationsDefinition = z.array(PgRollOperationDefinition);

export type PgRollMigration = z.infer<typeof PgRollMigrationDefinition>;

export const PgRollMigrationDefinition = z.object({
  name: z.string(),
  operations: PgRollOperationsDefinition
});

export type OperationType = (typeof operationTypes)[number];

export const operationTypes = [
  'add_column',
  'alter_column',
  'create_index',
  'create_table',
  'drop_column',
  'drop_constraint',
  'drop_index',
  'drop_table',
  'raw_sql',
  'rename_table',
  'set_replica_identity'
] as const;