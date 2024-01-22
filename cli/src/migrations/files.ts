import { Schemas } from '@xata.io/client';
import { mkdir, readdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { migrationFile, pgRollMigrationsFile } from './schema.js';
import { safeJSONParse, safeReadFile } from '../utils/files.js';
import { isPgRollMigration } from './pgroll.js';

const migrationsDir = path.join(process.cwd(), '.xata', 'migrations');
const ledgerFile = path.join(migrationsDir, '.ledger');

async function getLedger() {
  const ledger = await safeReadFile(ledgerFile, 'utf8');
  if (!ledger) return [];

  // Split by newlines and filter out empty lines
  return ledger.split('\n').filter((item) => item.trim() !== '');
}

async function readMigrationsDir() {
  try {
    await mkdir(migrationsDir, { recursive: true });
  } catch (e) {
    // Ignore
  }

  try {
    return await readdir(migrationsDir);
  } catch (e) {
    return [];
  }
}

export async function isPgRollFormat() {
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

export async function getLocalMigrationFiles(
  pgRollEnabled: boolean = false
): Promise<Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[]> {
  const files = await readMigrationsDir();
  const ledger = await getLedger();
  // Error out if there are any files that are not in the ledger
  for (const file of files) {
    if (file === '.ledger') continue;

    const fileName = file.split('.')[0];
    if (!ledger.includes(fileName)) {
      throw new Error(
        `Migration ${file} is not in the ledger, please run 'xata pull -f' to overwrite local migrations`
      );
    }
  }

  const migrations: Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[] = [];

  for (const entry of ledger) {
    // Ignore empty lines in ledger file
    if (entry === '') continue;
    const filePath = path.join(migrationsDir, `${entry}.json`);
    const fileContents = await safeReadFile(filePath);
    const result = pgRollEnabled
      ? pgRollMigrationsFile.safeParse(safeJSONParse(fileContents))
      : migrationFile.safeParse(safeJSONParse(fileContents));
    if (!result.success) {
      throw new TypeError(`Failed to parse migration file ${filePath}: ${result.error}`);
    }

    // TODO fix
    // @ts-expect-error
    migrations.push(result.data);
  }

  return migrations;
}

export async function writeLocalMigrationFiles(
  files: Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[]
) {
  const ledger = await getLedger();

  for (const file of files) {
    let name;
    if (isPgRollMigration(file)) {
      name = file.name;
    } else {
      // Checksums start with a version `1:` prefix, so we need to remove that
      const checksum = file.checksum?.replace(/^1:/, '').slice(0, 8) ?? '';
      name = [file.id, checksum].filter((item) => !!item).join('_');
    }

    const filePath = path.join(migrationsDir, `${name}.json`);
    await writeFile(filePath, JSON.stringify(file, null, 2) + '\n', 'utf8');
    ledger.push(name);
  }
  await writeFile(ledgerFile, ledger.join('\n') + '\n', 'utf8');
}

export async function removeLocalMigrations() {
  try {
    await rm(migrationsDir, { recursive: true });
  } catch (e) {
    // Ignore
  }
}

export function commitToMigrationFile(
  logs: Schemas.Commit[] | Schemas.PgRollMigrationHistoryItem[]
): Schemas.MigrationObject[] | Schemas.PgRollMigrationHistoryItem[] {
  // Schema history comes in reverse order, so we need to reverse it
  // TODO fix
  // @ts-expect-error
  return logs.reverse().map((log) => {
    return isPgRollMigration(log)
      ? {
          name: log.name,
          migration: log.migration,
          startedAt: log.startedAt,
          parent: log.parent,
          done: log.done,
          migrationType: log.migrationType
        }
      : {
          id: log.id,
          parentID: log.parentID,
          checksum: log.checksum,
          operations: log.operations
        };
  });
}
