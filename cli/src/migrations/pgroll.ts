import { Schemas } from '@xata.io/client';
import { migrationsDir, readMigrationsDir } from './files.js';
import path from 'path';
import { safeJSONParse, safeReadFile } from '../utils/files.js';
import { migrationFilePgroll, MigrationFilePgroll } from './schema.js';
import { XataClient } from '../base.js';

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
