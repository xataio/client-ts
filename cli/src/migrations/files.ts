import { Schemas } from '@xata.io/client';
import { mkdir, readdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { safeJSONParse, safeReadFile } from '../utils/files.js';
import { hydrateMigrationObject, isMigrationPgRollFormat } from './pgroll.js';
import { migrationFile, migrationFilePgroll, MigrationFilePgroll } from './schema.js';

export const migrationsDir = path.join(process.cwd(), '.xata', 'migrations');
const ledgerFile = path.join(migrationsDir, '.ledger');

async function getLedger() {
  const ledger = await safeReadFile(ledgerFile, 'utf8');
  if (!ledger) return [];

  // Split by newlines and filter out empty lines
  return ledger.split('\n').filter((item) => item.trim() !== '');
}

export async function readMigrationsDir() {
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

export type LocalMigrationFile =
  | Schemas.MigrationObject
  | (MigrationFilePgroll & { id?: never; checksum?: never; operations?: never[] });

export async function getLocalMigrationFiles(pgRollEnabled: boolean = false): Promise<LocalMigrationFile[]> {
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

  const migrations: LocalMigrationFile[] = [];

  for (const entry of ledger) {
    // Ignore empty lines in ledger file
    if (entry === '') continue;
    const filePath = path.join(migrationsDir, `${entry}.json`);
    const fileContents = await safeReadFile(filePath);

    const result = pgRollEnabled
      ? migrationFilePgroll.safeParse(safeJSONParse(fileContents))
      : migrationFile.safeParse(safeJSONParse(fileContents));
    if (!result.success) {
      throw new Error(`Failed to parse migration file ${filePath}: ${result.error}`);
    }

    // TODO: Remove type assertion when old migrations are removed
    migrations.push(result.data as LocalMigrationFile);
  }

  return migrations;
}

export async function writeLocalMigrationFiles(files: LocalMigrationFile[]) {
  const ledger = await getLedger();

  for (const file of files) {
    // Checksums start with a version `1:` prefix, so we need to remove that
    const checksum = file.checksum?.replace(/^1:/, '').slice(0, 8) ?? '';
    const name = [getMigrationId(file), checksum].filter((item) => !!item).join('_');

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

export function commitToMigrationFile(logs: (Schemas.Commit | Schemas.MigrationHistoryItem)[]): LocalMigrationFile[] {
  // Schema history comes in reverse order, so we need to reverse it
  return logs.reverse().map((log) =>
    isMigrationPgRollFormat(log)
      ? hydrateMigrationObject(log)
      : {
          id: log.id,
          parentID: log.parentID,
          checksum: log.checksum,
          operations: log.operations
        }
  );
}

export function getMigrationId(file?: LocalMigrationFile) {
  return file?.id ?? file?.name;
}

export const getLastCommonIndex = (
  localMigrationFiles: LocalMigrationFile[],
  remoteMigrationFiles: LocalMigrationFile[]
) => {
  return remoteMigrationFiles.reduce((index, remoteMigration) => {
    if (
      !!getMigrationId(remoteMigration) &&
      getMigrationId(remoteMigration) === getMigrationId(localMigrationFiles[index + 1])
    ) {
      return index + 1;
    }

    return index;
  }, -1);
};
