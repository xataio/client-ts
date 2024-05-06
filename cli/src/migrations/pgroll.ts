import { Schemas, XataApiClient } from '@xata.io/client';
import { Column } from '@xata.io/codegen';
import { OpRawSQL, OpRenameConstraint, PgRollOperation } from '@xata.io/pgroll';
import path from 'path';
import z from 'zod';
import { XataClient } from '../base.js';
import { BranchSchemaFormatted } from '../commands/schema/types.js';
import { safeJSONParse, safeReadFile } from '../utils/files.js';
import { migrationsDir, readMigrationsDir } from './files.js';
import { MigrationFilePgroll, migrationFilePgroll } from './schema.js';

export const isBranchPgRollEnabled = (details: Schemas.DBBranch) => {
  // @ts-expect-error TODO: Fix this when api is finalized
  return !!details.usePgRoll;
};

export const isMigrationPgRollFormat = (
  migration: Schemas.MigrationObject | Schemas.MigrationHistoryItem | MigrationFilePgroll
): migration is Schemas.MigrationHistoryItem => {
  return 'migration' in migration;
};

export const hydrateMigrationObject = (migration: Schemas.MigrationHistoryItem): MigrationFilePgroll => {
  return { ...migration, migration: JSON.parse(migration.migration) };
};

export async function allMigrationsPgRollFormat() {
  const files = await readMigrationsDir();
  for (const file of files) {
    if (file === '.ledger') continue;

    const filePath = path.join(migrationsDir, file);
    const fileContents = await safeReadFile(filePath);
    const result = migrationFilePgroll.safeParse(safeJSONParse(fileContents));
    if (!result.success) {
      return false;
    }
  }
  return true;
}

const getPgRollLink = (table: any, column: any) => {
  const foreignKeysForTable = table.foreignKeys;
  const foreignKeys = Object.keys(foreignKeysForTable ?? {});
  for (const key of foreignKeys) {
    const k = foreignKeysForTable[key];
    if (k && k.columns?.includes(column.name)) {
      return k;
    }
  }
  return null;
};

export const xataStringColumns = ['email', 'text', 'string'] as const;

const XataStringColumn = z.object({
  ['xata.type']: z.enum(xataStringColumns)
});

export type XataStringColumnType = z.infer<typeof XataStringColumn>;

const narrowStringType = (comment?: string): Column['type'] => {
  if (!comment) return 'text';
  const result = XataStringColumn.safeParse(JSON.parse(comment));
  return result.success ? result.data['xata.type'] : 'text';
};

function pgRollToXataColumnType(type: string, comment?: string): string {
  switch (type) {
    case 'boolean':
    case 'bool':
      return 'bool';
    case 'bigint':
    case 'int8':
    case 'integer':
    case 'int':
    case 'int4':
    case 'smallint':
      return 'int';
    case 'double precision':
    case 'float8':
    case 'real':
      return 'float';
    case 'text':
    case 'varchar':
    case 'character varying':
      return narrowStringType(comment);
    case 'timestamptz':
      return 'datetime';
    case 'text[]':
      return 'multiple';
    case 'json':
    case 'jsonb':
      return 'json';
    case 'xata_file':
      return 'file';
    case 'xata_file_array':
      return 'file[]';
    case 'real[]':
      return 'vector';
  }

  if (type.startsWith('character(') || type.startsWith('varchar(')) return 'string';
  if (type.startsWith('numeric(')) return 'float';

  return type;
}

export async function getBranchDetailsWithPgRoll(
  xata: XataClient,
  { workspace, region, database, branch }: { workspace: string; region: string; database: string; branch: string }
): Promise<Schemas.DBBranch> {
  const details = await xata.api.branch.getBranchDetails({
    pathParams: { workspace, region, dbBranchName: `${database}:${branch}` }
  });

  if (isBranchPgRollEnabled(details)) {
    const pgroll = await xata.api.migrations.getSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` }
    });

    return {
      ...details,
      branchName: branch,
      createdAt: new Date().toISOString(),
      databaseName: database,
      id: pgroll.schema.name, // Not really
      lastMigrationID: '', // Not really
      version: 1,
      metadata: {},
      schema: {
        tables: Object.entries(pgroll.schema.tables ?? []).map(([name, table]: any) => ({
          name,
          checkConstraints: table.checkConstraints,
          foreignKeys: table.foreignKeys,
          primaryKey: table.primaryKey,
          uniqueConstraints: table.uniqueConstraints,
          columns: Object.values(table.columns ?? {})
            .filter((column: any) => !['_id', '_createdat', '_updatedat', '_version'].includes(column.name))
            .map((column: any) => ({
              name: column.name,
              type: getPgRollLink(table, column) ? 'link' : pgRollToXataColumnType(column.type, column.comment),
              link: getPgRollLink(table, column) ? { table: getPgRollLink(table, column).referencedTable } : undefined,
              file:
                pgRollToXataColumnType(column.type) === 'file' || pgRollToXataColumnType(column.type) === 'file[]'
                  ? { defaultPublicAccess: false }
                  : undefined,
              notNull: column.nullable === false,
              unique: column.unique === true,
              defaultValue: column.default,
              comment: column.comment
            }))
        }))
      } as any
    };
  }

  return details;
}

export const isColumnTypeUnsupported = (type: string) => {
  switch (type) {
    case 'bool':
    case 'int':
    case 'float':
    case 'datetime':
    case 'multiple':
    case 'json':
    case 'file':
    case 'file[]':
    case 'text':
    case 'link':
    case 'string':
    case 'email':
    case 'vector':
      return false;
    default:
      return true;
  }
};

export function xataColumnTypeToPgRoll(type: Column['type']): string {
  if (isColumnTypeUnsupported(type)) return type;
  switch (type) {
    case 'bool':
      return 'boolean';
    case 'int':
      return 'bigint';
    case 'float':
      return 'double precision';
    case 'datetime':
      return 'timestamptz';
    case 'multiple':
      return 'text[]';
    case 'json':
      return 'jsonb';
    case 'file':
      return 'xata.xata_file';
    case 'file[]':
      return 'xata.xata_file_array';
    case 'text':
    case 'string':
    case 'email':
    case 'link':
      return 'text';
    case 'vector':
      return 'real[]';
    default:
      return 'text';
  }
}

export const exhaustiveCheck = (x: never): never => {
  throw new Error(`Unhandled discriminated union member: ${x}`);
};

export const generateLinkReference = ({
  column,
  table,
  onDelete: on_delete = 'SET NULL'
}: {
  column: string;
  table: string;
  onDelete?: string;
}) => {
  return {
    name: `${column}_link`,
    table,
    column: 'xata_id',
    on_delete
  };
};

export const xataColumnTypeToPgRollConstraintName = (
  tableName: string,
  columnName: string,
  columnType: Column['type']
) => {
  return `${tableName}_xata_${columnType}_length_${columnName}`;
};

export const xataColumnTypeToPgRollConstraint = (column: Column, table: string) => {
  const getConstraint = () => {
    if (isColumnTypeUnsupported(column.type)) return undefined;
    switch (column.type) {
      case 'vector':
        return `ARRAY_LENGTH("${column.name}", 1) = ${column.vector?.dimension}`;
      case 'string':
      case 'email':
        return `LENGTH("${column.name}") <= 2048`;
      case 'text':
        return `OCTET_LENGTH("${column.name}") <= 204800`;
      case 'multiple':
        return `OCTET_LENGTH(ARRAY_TO_STRING("${column.name}", '')) < 65536`;
      case 'link':
      case 'bool':
      case 'datetime':
      case 'file':
      case 'file[]':
      case 'float':
      case 'int':
      case 'json':
        return undefined;
      default:
        return undefined;
    }
  };

  const constraint = getConstraint();
  return constraint
    ? {
        name: xataColumnTypeToPgRollConstraintName(table, column.name, column.type),
        constraint
      }
    : undefined;
};

export const xataColumnTypeToPgRollComment = (column: Column) => {
  const getType = () => {
    switch (column.type) {
      case 'vector':
        return { 'xata.search.dimension': column.vector?.dimension };
      case 'link':
        return { 'xata.link': column.link?.table };
      case 'string':
      case 'text':
      case 'email':
        return { 'xata.type': column.type };
      case 'file':
        return { 'xata.file.dpa': column.file?.defaultPublicAccess ?? false };
      case 'file[]':
        return { 'xata.file.dpa': column['file[]']?.defaultPublicAccess ?? false };
      case 'float':
      case 'int':
      case 'json':
      case 'multiple':
      case 'bool':
      case 'datetime':
        return undefined;
      default:
        return 'text';
    }
  };

  const result = getType();
  return result !== undefined ? JSON.stringify(result) : undefined;
};

export const requiresUpArgument = (notNull: Column['notNull'], defaultValue: unknown) =>
  notNull && (defaultValue === null || defaultValue === undefined);

export function xataColumnTypeToZeroValue(type: Column['type'], defaultValue: unknown): string {
  if (defaultValue !== undefined && defaultValue !== null) return `${defaultValue}`;
  if (isColumnTypeUnsupported(type)) return "''";
  switch (type) {
    case 'bool':
      return 'false';
    case 'int':
    case 'float':
      return '0';
    case 'datetime':
      return 'now()';
    case 'link':
      return 'null';
    case 'email':
    case 'text':
    case 'string':
      return "''";
    case 'vector':
    case 'multiple':
    case 'json':
    case 'file':
    case 'file[]':
      return "'{}'";
    default:
      return "''";
  }
}

export async function waitForMigrationToFinish(
  api: XataApiClient,
  workspace: string,
  region: string,
  database: string,
  branch: string,
  jobId: string
): Promise<void> {
  const { status, error } = await api.migrations.getMigrationJobStatus({
    pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, jobId }
  });
  if (status === 'failed') {
    throw new Error(`Migration failed, ${error}`);
  }

  if (status === 'completed') {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await waitForMigrationToFinish(api, workspace, region, database, branch, jobId);
}

const getTable = (tableName: string, branchDetails: BranchSchemaFormatted) => {
  return branchDetails?.schema.tables.find((table) => table.name === tableName);
};

export const updateConstraint = (
  branchDetails: BranchSchemaFormatted,
  operation: PgRollOperation
): { rename_constraint: OpRenameConstraint }[] | undefined => {
  const migrations: { rename_constraint: OpRenameConstraint }[] = [];

  const getUpdatedConstraintName = (params: {
    constraintName: string;
    replacement: string;
    type: 'table' | 'column';
  }) => {
    const { constraintName, replacement, type } = params;
    const baseRegex = '_xata_(?:vector|string|text|multiple|email)_length_';
    const regex =
      type === 'table' ? new RegExp(`(.*)${baseRegex}(?:.*)`, 'dgm') : new RegExp(`(?:.*)${baseRegex}(.*)`, 'dgm');

    type RegExpMatchArrayWithIndices = RegExpMatchArray & { indices: Array<[number, number]> };

    const matches = regex.exec(constraintName) as RegExpMatchArrayWithIndices;
    if (!matches) return constraintName;
    // e.g. of indices: [ [ 0, 24 ], [ 22, 24 ]
    if (matches?.indices?.length !== 2 || matches?.indices[0]?.length !== 2) return constraintName;
    const start = matches.indices[1][0];
    const finish = matches.indices[1][1];
    const arr = constraintName.split('');
    arr.splice(start, finish, replacement);
    return arr.join('');
  };

  if (
    'alter_column' in operation &&
    operation.alter_column.name &&
    operation.alter_column.name !== operation.alter_column.column
  ) {
    const table = getTable(operation.alter_column.table, branchDetails);
    if (!table) return undefined;

    const oldColumn = table.columns
      .map(({ type, name, comment }) => ({ type, name, comment }))
      .find((column) => column.name === operation.alter_column.column);
    if (!oldColumn) return undefined;

    const oldColumnType = pgRollToXataColumnType(oldColumn.type, oldColumn.comment);
    if (!oldColumnType) return undefined;

    const constraint = Object.values(table.checkConstraints ?? {}).find(
      (constraint) =>
        constraint.name ===
        xataColumnTypeToPgRollConstraintName(table.name, operation.alter_column.column, oldColumnType as Column['type'])
    );
    if (!constraint) return undefined;

    const newConstraintName = getUpdatedConstraintName({
      constraintName: constraint.name,
      replacement: operation.alter_column.name,
      type: 'column'
    });
    if (newConstraintName === constraint.name) return undefined;

    migrations.push({
      rename_constraint: {
        table: table.name,
        from: constraint.name,
        to: newConstraintName
      }
    });
  }

  if ('rename_table' in operation) {
    const table = getTable(operation.rename_table.from, branchDetails);
    if (!table) return undefined;

    Object.values(table.checkConstraints ?? {}).forEach((constraint) => {
      const newConstraintName = getUpdatedConstraintName({
        constraintName: constraint.name,
        replacement: operation.rename_table.to,
        type: 'table'
      });
      if (newConstraintName === constraint.name) return undefined;

      migrations.push({
        rename_constraint: {
          table: operation.rename_table.to,
          from: constraint.name,
          to: newConstraintName
        }
      });
    });
  }

  return migrations.length > 0 ? migrations : undefined;
};

const isValidXataLink = ({ key }: { key: Schemas.BranchSchema['tables'][number]['foreignKeys'][number] }) => {
  return key.referencedColumns.length === 1 && key.referencedColumns.includes('xata_id');
};

export const updateLinkComment = (
  branchDetails: BranchSchemaFormatted,
  operation: PgRollOperation
): { sql: OpRawSQL }[] | undefined => {
  const migrationSql: string[] = [];

  if ('rename_table' in operation) {
    const tablesToUpdate =
      branchDetails?.schema.tables.reduce((acc, table) => {
        const keys = Object.values(table.foreignKeys);
        for (const key of keys) {
          if (key.referencedTable === operation.rename_table.from && isValidXataLink({ key })) {
            acc.push({ [table.name]: key.columns });
          }
        }
        return acc;
      }, [] as { [tableName: string]: string[] }[]) ?? [];

    for (const key of tablesToUpdate) {
      const tableName = Object.keys(key)[0];
      const columns = key[tableName];
      columns.forEach((column) => {
        const table = getTable(tableName, branchDetails);
        const columnToUpdate = table?.columns.find((col) => col.name === column);
        if (tableNameFromLinkComment(columnToUpdate?.comment ?? '')) {
          migrationSql.push(
            `COMMENT ON COLUMN "${tableName}"."${column}" IS '${JSON.stringify({
              'xata.link': operation.rename_table.to
            })}'`
          );
        }
      });
    }
  }
  return migrationSql.length > 0 ? [{ sql: { up: migrationSql.join(';') } }] : undefined;
};

const XataLinkColumn = z.object({
  ['xata.link']: z.string()
});

export const tableNameFromLinkComment = (comment: string) => {
  try {
    const obj = JSON.parse(comment);
    const result = XataLinkColumn.safeParse(obj);
    return result.success ? result.data['xata.link'] : null;
  } catch (e) {
    return null;
  }
};
