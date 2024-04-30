import { Schemas, XataApiClient } from '@xata.io/client';
import { Column } from '@xata.io/codegen';
import path from 'path';
import z from 'zod';
import { XataClient } from '../base.js';
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
    case 'xata.xata_file':
      return 'file';
    case 'xata.xata_file_array':
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
              type: column.type,
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
  return `${tableName}_xata_${
    columnType === 'real[]' ? 'vector' : columnType === 'text[]' ? 'multiple' : columnType
  }_length_${columnName}`;
};

export const xataColumnTypeToPgRollConstraint = (column: Column, table: string) => {
  const getConstraint = () => {
    if (column.vector) {
      return `ARRAY_LENGTH("${column.name}", 1) = ${column.vector?.dimension}`;
    } else if (column.type === 'text') {
      return `OCTET_LENGTH("${column.name}") <= 204800`;
    } else if (column.type === 'text[]') {
      return `OCTET_LENGTH(ARRAY_TO_STRING("${column.name}", '')) < 65536`;
    }
    return undefined;
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
    if (column.link) {
      return { 'xata.link': column.link?.table };
    }
    if (column.vector) {
      return { 'xata.search.dimension': column.vector?.dimension };
    }
    if (column.file) {
      return { 'xata.file.dpa': column.file?.defaultPublicAccess ?? false };
    }
    if (column['file[]']) {
      return { 'xata.file.dpa': column['file[]']?.defaultPublicAccess ?? false };
    }
    return undefined;
  };

  const result = getType();
  return result !== undefined ? JSON.stringify(result) : undefined;
};

export const requiresUpArgument = (notNull: Column['notNull'], defaultValue: unknown) =>
  notNull && (defaultValue === null || defaultValue === undefined);

export function xataColumnTypeToZeroValue(type: Column['type'], defaultValue: unknown): string {
  if (defaultValue !== undefined && defaultValue !== null) return `${defaultValue}`;
  switch (type) {
    case 'bool':
    case 'boolean':
      return 'false';
    case 'bigint':
    case 'int8':
    case 'integer':
    case 'int':
    case 'int4':
    case 'smallint':
    case 'double precision':
    case 'float8':
    case 'real':
      return '0';
    case 'timestamptz':
      return 'now()';
    case 'real[]':
    case 'multiple':
    case 'text[]':
    case 'jsonb':
    case 'xata.xata_file':
    case 'xata.xata_file_array':
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
