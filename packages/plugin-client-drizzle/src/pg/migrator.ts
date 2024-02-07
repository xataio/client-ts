import { MigrationConfig, readMigrationFiles } from 'drizzle-orm/migrator';
import type { XataDatabase } from './driver.js';

export async function migrate<TSchema extends Record<string, unknown>>(
  db: XataDatabase<TSchema>,
  config: string | MigrationConfig
) {
  const migrations = readMigrationFiles(config);
  // @ts-expect-error session and dialect are internal
  await db.dialect.migrate(migrations, db.session);
}
