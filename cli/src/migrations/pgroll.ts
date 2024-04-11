import { Schemas, XataApiClient } from '@xata.io/client';
import { migrationsDir, readMigrationsDir } from './files.js';
import path from 'path';
import { XataClient } from '../base.js';
import { Column } from '@xata.io/codegen';
import { MigrationFilePgroll, migrationFilePgroll } from './schema.js';
import { safeJSONParse, safeReadFile } from '../utils/files.js';

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

function pgRollToXataColumnType(type: string): string {
  switch (type) {
    case 'boolean':
      return 'bool';
    case 'bigint':
    case 'integer':
      return 'int';
    case 'double precision':
      return 'float';
    case 'text':
      return 'text';
    case 'timestamptz':
      return 'datetime';
    case 'text[]':
      return 'multiple';
    case 'jsonb':
      return 'json';
    case 'xata_file':
      return 'file';
    case 'xata_file_array':
      return 'file[]';
    case 'real[]':
      return 'vector';
    default:
      return type;
  }
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
          columns: Object.values(table.columns ?? {})
            .filter((column: any) => !['_id', '_createdat', '_updatedat', '_version'].includes(column.name))
            .map((column: any) => ({
              name: column.name,
              type: getPgRollLink(table, column) ? 'link' : pgRollToXataColumnType(column.type),
              link: getPgRollLink(table, column) ? { table: getPgRollLink(table, column).referencedTable } : undefined,
              file:
                pgRollToXataColumnType(column.type) === 'file' || pgRollToXataColumnType(column.type) === 'file[]'
                  ? { defaultPublicAccess: false }
                  : undefined,
              notNull: column.nullable === false,
              unique: column.unique === true,
              defaultValue: column.default
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
      return exhaustiveCheck(type);
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
        return exhaustiveCheck(column.type);
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
        return exhaustiveCheck(column.type);
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
      return exhaustiveCheck(type);
  }
}

export const notNullUpValue = (column: Column, notNull: boolean) => {
  return {
    up: notNull
      ? `(SELECT CASE WHEN "${column.name}" IS NULL THEN ${xataColumnTypeToZeroValue(
          column.type,
          column.defaultValue
        )} ELSE "${column.name}" END)`
      : `"${column.name}"`,
    down: notNull
      ? `"${column.name}"`
      : `(SELECT CASE WHEN "${column.name}" IS NULL THEN ${xataColumnTypeToZeroValue(
          column.type,
          column.defaultValue
        )} ELSE "${column.name}" END)`
  };
};

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
