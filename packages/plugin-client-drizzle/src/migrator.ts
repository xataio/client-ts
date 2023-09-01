import { MigrationConfig, readMigrationFiles } from 'drizzle-orm/migrator';
import { XataDatabase } from './driver';

export async function migrate<TSchema extends Record<string, unknown>>(
  _db: XataDatabase<TSchema>,
  config: string | MigrationConfig
) {
  const migrations = readMigrationFiles(config);
  console.debug('migrations', migrations);

  throw new Error('Migrations are not supported yet');
}
