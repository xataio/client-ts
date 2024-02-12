import { MigrationConfig, readMigrationFiles } from 'drizzle-orm/migrator';
import type { XataDatabase } from './driver.js';
import { sql } from 'drizzle-orm';
import { HostProvider, XataApiClient } from '@xata.io/client';

export type XataConfiguration = {
  host?: HostProvider;
  workspace: string;
  region: string;
  database: string;
  branch: string;
  apiKey: string;
};

export async function migrate<TSchema extends Record<string, unknown>>(
  { workspace, region, database, branch, host, apiKey }: XataConfiguration,
  config: string | MigrationConfig
) {
  console.log('migrate', { workspace, region, database, branch, host, apiKey, config });
  const migrations = readMigrationFiles(config);
  console.log('migrations', migrations);

  const api = new XataApiClient({ apiKey, host });
  const history = await api.branches.pgRollMigrationHistory({ workspace, region, database, branch });
  console.log('history', history);

  const lastDbMigration = history.migrations[0];

  for (const migration of migrations) {
    if (!lastDbMigration || Number(new Date(lastDbMigration.startedAt)) < migration.folderMillis) {
      for (const stmt of migration.sql) {
        console.log('applying', stmt);
        const { jobID } = await api.branches.applyMigration({
          workspace,
          region,
          database,
          branch,
          // @ts-ignore
          migration: { operations: [{ sql: { up: stmt } }] }
        });

        await waitForMigrationToFinish(api, workspace, region, database, branch, jobID);
      }
    }
  }

  throw new Error('Not implemented');

  /**await db.execute(sql`
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
  });**/
}

async function waitForMigrationToFinish(
  api: XataApiClient,
  workspace: string,
  region: string,
  database: string,
  branch: string,
  jobId: string
) {
  const { status } = await api.branches.pgRollJobStatus({ workspace, region, database, branch, jobId });
  if (status === 'failed') {
    throw new Error('Migration failed');
  }

  if (status === 'completed') {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await waitForMigrationToFinish(api, workspace, region, database, branch, jobId);
}
