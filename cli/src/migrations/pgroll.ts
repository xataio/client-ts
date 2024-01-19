import { Schemas } from '@xata.io/client';

export const isPgRollEnabled = (details: Schemas.DBBranch) => {
  // @ts-expect-error TODO: Fix this when api is finalized
  return !!details.usePgRoll;
};

export const migrationsNotPgRollFormat = (
  migrations: Schemas.PgRollMigrationHistoryItem[] | Schemas.MigrationObject[]
) => {
  return migrations.length === 0 || !('id' in migrations);
};

export const isPgRollMigration = (
  migration: Schemas.MigrationObject | Schemas.PgRollMigrationHistoryItem
): migration is Schemas.PgRollMigrationHistoryItem => {
  return 'migration' in migration;
};
