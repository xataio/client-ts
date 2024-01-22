import { Schemas } from '@xata.io/client';
import { migrationsDir, readMigrationsDir } from './files.js';
import path from 'path';
import { safeJSONParse, safeReadFile } from '../utils/files.js';
import { pgRollMigrationsFile } from './schema.js';

export const isBranchPgRollEnabled = (details: Schemas.DBBranch) => {
  // @ts-expect-error TODO: Fix this when api is finalized
  return !!details.usePgRoll;
};

export const isMigrationPgRollFormat = (
  migration: Schemas.MigrationObject | Schemas.PgRollMigrationHistoryItem
): migration is Schemas.PgRollMigrationHistoryItem => {
  return 'migration' in migration;
};

export async function allMigrationsPgRollFormat() {
  const files = await readMigrationsDir();
  for (const file of files) {
    if (file === '.ledger') continue;

    const filePath = path.join(migrationsDir, file);
    const fileContents = await safeReadFile(filePath);
    const result = pgRollMigrationsFile.safeParse(safeJSONParse(fileContents));
    if (!result.success) {
      return false;
    }
  }
  return true;
}
