import { Schemas } from '@xata.io/client';
import { migrationsDir, readMigrationsDir } from './files';
import path from 'path';
import { safeJSONParse, safeReadFile } from '../utils/files';
import { pgRollMigrationsFile } from './schema';

export const isBranchPgRoll = (details: Schemas.DBBranch) => {
  // @ts-expect-error TODO: Fix this when api is finalized
  return !!details.usePgRoll;
};

export const isMigrationPgRollFormat = (
  migration: Schemas.MigrationObject | Schemas.PgRollMigrationHistoryItem
): migration is Schemas.PgRollMigrationHistoryItem => {
  return pgRollMigrationsFile.safeParse(safeJSONParse(migration))?.success;
};

export async function allMigrationsPgRollFormat() {
  const files = await readMigrationsDir();
  const pgRollFormat = [];
  for (const file of files) {
    if (file === '.ledger') continue;
    const filePath = path.join(migrationsDir, file);
    const fileContents = await safeReadFile(filePath);
    pgRollFormat.push(isMigrationPgRollFormat(fileContents as any));
  }
  return pgRollFormat.every((el) => el);
}
