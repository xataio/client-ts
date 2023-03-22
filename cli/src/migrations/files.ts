import { Schemas } from '@xata.io/client';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { migrationFile } from './schema.js';

const migrationsDir = path.join(process.cwd(), '.xata', 'migrations');
const ledgerFile = path.join(migrationsDir, '.ledger');

async function getLedger() {
  try {
    const ledger = await readFile(ledgerFile, 'utf8');

    // Split by newlines and filter out empty lines
    return ledger.split('\n').filter((item) => item.trim() !== '');
  } catch (e) {
    return [];
  }
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

export async function getLocalMigrationFiles(): Promise<Schemas.MigrationObject[]> {
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

  const migrations: Schemas.MigrationObject[] = [];

  for (const entry of ledger) {
    const filePath = path.join(migrationsDir, `${entry}.json`);
    const fileContents = await readFile(filePath, 'utf8');
    const result = migrationFile.safeParse(JSON.parse(fileContents));
    if (!result.success) {
      throw new Error(`Failed to parse migration file ${filePath}: ${result.error}`);
    }

    migrations.push(result.data);
  }

  return migrations;
}

export async function writeLocalMigrationFiles(files: Schemas.MigrationObject[]) {
  const ledger = await getLedger();

  for (const file of files) {
    // Checksums start with a version `1:` prefix, so we need to remove that
    const checksum = file.checksum?.replace(/^1:/, '').slice(0, 8) ?? '';
    const name = [file.id, checksum].filter((item) => !!item).join('_');
    const filePath = path.join(migrationsDir, `${name}.json`);
    await writeFile(filePath, JSON.stringify(file, null, 2) + '\n', 'utf8');

    ledger.push(name);
  }

  await writeFile(ledgerFile, ledger.join('\n') + '\n', 'utf8');
}

export async function removeLocalMigrations() {
  await rm(migrationsDir, { recursive: true });
}

export function commitToMigrationFile(logs: Schemas.Commit[]): Schemas.MigrationObject[] {
  // Schema history comes in reverse order, so we need to reverse it
  return logs.reverse().map((log) => ({
    id: log.id,
    parentID: log.parentID,
    checksum: log.checksum,
    operations: log.operations
  }));
}
