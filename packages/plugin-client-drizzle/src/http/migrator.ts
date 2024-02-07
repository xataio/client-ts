import { MigrationConfig, readMigrationFiles } from 'drizzle-orm/migrator';
import { XataHttpDatabase } from './driver';

export async function migrate<TSchema extends Record<string, unknown>>(
  _db: XataHttpDatabase<TSchema>,
  config: string | MigrationConfig
) {
  const migrations = readMigrationFiles(config);
  console.debug('migrations', migrations);

  throw new Error('Migrations are not supported yet');
}
