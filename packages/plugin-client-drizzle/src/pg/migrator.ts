import { MigrationConfig, readMigrationFiles } from 'drizzle-orm/migrator';
import type { XataDatabase } from './driver.js';
import { sql } from 'drizzle-orm';

export async function migrate<TSchema extends Record<string, unknown>>(
  db: XataDatabase<TSchema>,
  config: string | MigrationConfig
) {
  const migrations = readMigrationFiles(config);

  await db.execute(sql`
			CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`);

  const { rows: dbMigrations } = await db.execute<{ id: number; hash: string; created_at: string }>(
    sql`select id, hash, created_at from "__drizzle_migrations" order by created_at desc limit 1`
  );

  const lastDbMigration = dbMigrations[0];
  await db.transaction(async (tx) => {
    for await (const migration of migrations) {
      if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
        for (const stmt of migration.sql) {
          await tx.execute(sql.raw(stmt));
        }
        await tx.execute(
          sql`insert into "__drizzle_migrations" ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
        );
      }
    }
  });
}
