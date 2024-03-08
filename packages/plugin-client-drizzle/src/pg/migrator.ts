import { MigrationConfig, readMigrationFiles } from 'drizzle-orm/migrator';
import type { XataDatabase } from './driver';

export async function migrate<TSchema extends Record<string, unknown>>(
  db: XataDatabase<TSchema>,
  config: string | MigrationConfig
) {
  const migrations = readMigrationFiles(config);
  // @ts-expect-error dialect and session are private
  await db.dialect.migrate(migrations, db.session, config);
}
