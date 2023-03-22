import { readFile, readdir, writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { migrationFile, MigrationFile } from './schema.js';
import { Schemas } from '@xata.io/client';
import canonicalize from 'canonicalize';

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

export async function getLocalMigrationFiles() {
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

  const migrations: MigrationFile[] = [];

  for (const entry of ledger) {
    const filePath = path.join(migrationsDir, `${entry}.json`);
    const fileContents = await readFile(filePath, 'utf8');
    const result = migrationFile.safeParse(JSON.parse(fileContents));
    if (!result.success) {
      throw new Error(`Failed to parse migration file ${filePath}: ${result.error}`);
    }

    const checksum = await computeChecksum(result.data);
    // TODO: Remove the existance check once backend backfills checksums
    if (result.data.checksum && result.data.checksum !== checksum) {
      console.warn(
        `Checksum for migration ${result.data.id} does not match, please run 'xata pull -f' to overwrite local migrations'`
      );
      console.warn(`Expected ${result.data.checksum}, got ${checksum}`);
    }

    const fileChecksum = entry.split('_').slice(-1)[0];
    if (!checksum.startsWith(fileChecksum)) {
      console.warn(
        `Checksum for migration ${result.data.id} does not match, please run 'xata pull -f' to overwrite local migrations'`
      );
    }

    migrations.push(result.data);
  }

  return migrations;
}

export async function writeLocalMigrationFiles(files: MigrationFile[]) {
  const ledger = await getLedger();

  for (const file of files) {
    const checksum = await computeChecksum(file);

    // TODO: Remove the existance check once backend backfills checksums
    if (file.checksum && file.checksum !== checksum) {
      console.warn(
        `Checksum for migration ${file.id} does not match, please run 'xata pull -f' to overwrite local migrations'`
      );

      console.warn(`Expected ${file.checksum}, got ${checksum}`);
    }

    const name = [file.id, checksum.slice(0, 8)].filter((item) => !!item).join('_');
    const filePath = path.join(migrationsDir, `${name}.json`);
    await writeFile(filePath, JSON.stringify(file, null, 2) + '\n', 'utf8');

    ledger.push(name);
  }

  await writeFile(ledgerFile, ledger.join('\n') + '\n', 'utf8');
}

export async function removeLocalMigrations() {
  await rm(migrationsDir, { recursive: true });
}

export async function computeChecksum(file: MigrationFile): Promise<string> {
  const input = canonicalize({
    id: file.id,
    parentID: file.parent,
    parentChecksum: file.checksum,
    operations: file.operations
  });

  if (!input) throw new Error('Failed to canonicalize input to compute checksum');

  return crypto.createHash('sha256').update(input).digest('hex');
}

export function commitToMigrationFile(logs: Schemas.Commit[]): MigrationFile[] {
  // Schema history comes in reverse order, so we need to reverse it
  return logs.reverse().map((log) => ({
    id: log.id,
    parent: log.parentID ?? '',
    checksum: log.checksum ?? '',
    operations: log.operations
  }));
}
