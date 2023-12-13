import { z } from 'zod';

export type ColumnDefinition = z.infer<typeof columnDefinition>;

export const columnDefinition = z.object({
  name: z.string(),
  type: z.string(),
  pk: z.boolean().optional(),
  unique: z.boolean().optional(),
  nullable: z.boolean().optional(),
  default: z.string().optional()
});

export type ConstraintDefinition = z.infer<typeof constraintDefinition>;

export const constraintDefinition = z.object({
  name: z.string(),
  constraint: z.string()
});

export type ReferenceDefinition = z.infer<typeof referenceDefinition>;

export const referenceDefinition = z.object({
  name: z.string(),
  table: z.string(),
  column: z.string()
});

export type CreateTableOperation = z.infer<typeof createTableOperation>;

export const createTableOperation = z.object({
  create_table: z.object({
    name: z.string(),
    columns: z.array(columnDefinition),
    references: z
      .object({
        name: z.string().optional(),
        table: z.string().optional(),
        column: z.string().optional()
      })
      .optional(),
    check: z
      .object({
        name: z.string().optional(),
        constraint: z.string().optional()
      })
      .optional()
  })
});

export type AddColumnOperation = z.infer<typeof addColumnOperation>;

export const addColumnOperation = z.object({
  add_column: z.object({
    table: z.string(),
    up: z.string().optional(),
    column: columnDefinition
  })
});

export type RenameTableOperation = z.infer<typeof renameTableOperation>;

export const renameTableOperation = z.object({
  rename_table: z.object({
    from: z.string(),
    to: z.string()
  })
});

export type SQLOperation = z.infer<typeof sqlOperation>;

export const sqlOperation = z.object({
  sql: z.object({
    up: z.string(),
    down: z.string()
  })
});

export type DropTableOperation = z.infer<typeof dropTableOperation>;

export const dropTableOperation = z.object({
  drop_table: z.object({
    name: z.string()
  })
});

export type DropColumnOperation = z.infer<typeof dropColumnOperation>;

export const dropColumnOperation = z.object({
  drop_column: z.object({
    table: z.string(),
    column: z.string(),
    down: z.string()
  })
});

export type CreateIndexOperation = z.infer<typeof createIndexOperation>;

export const createIndexOperation = z.object({
  create_index: z.object({
    name: z.string(),
    table: z.string(),
    columns: z.array(z.string())
  })
});

export type DropIndexOperation = z.infer<typeof dropIndexOperation>;

export const dropIndexOperation = z.object({
  drop_index: z.object({
    name: z.string()
  })
});

export type AlterColumnOperation = z.infer<typeof alterColumnOperation>;

export const alterColumnOperation = z.object({
  alter_column: z.object({
    table: z.string(),
    column: z.string(),
    name: z.string(),
    type: z.string(),
    up: z.string(),
    down: z.string(),
    unique: constraintDefinition.optional(),
    nullable: z.boolean().optional(),
    check: constraintDefinition.optional(),
    references: referenceDefinition.optional()
  })
});

export type SetReplicaIdentityOperation = z.infer<typeof setReplicaIdentityOperation>;

export const setReplicaIdentityOperation = z.object({
  set_replica_identity: z.object({
    table: z.string(),
    identity: z.object({
      type: z.string(),
      index: z.string()
    })
  })
});

export type DropConstraintOperation = z.infer<typeof dropConstraintOperation>;

export const dropConstraintOperation = z.object({
  drop_constraint: z.object({
    table: z.string(),
    column: z.string(),
    name: z.string(),
    up: z.string(),
    down: z.string()
  })
});

export type Operation = z.infer<typeof operation>;

export const operation = z.union([
  createTableOperation,
  addColumnOperation,
  renameTableOperation,
  sqlOperation,
  dropTableOperation,
  dropColumnOperation,
  createIndexOperation,
  dropIndexOperation,
  alterColumnOperation,
  setReplicaIdentityOperation,
  dropConstraintOperation
]);

export const operations = z.array(operation);

export const operationTypes = [
  'create_table',
  'add_column',
  'rename_table',
  'sql',
  'drop_table',
  'drop_column',
  'create_index',
  'drop_index',
  'alter_column',
  'set_replica_identity',
  'drop_constraint'
] as const;

export type OperationType = (typeof operationTypes)[number];
