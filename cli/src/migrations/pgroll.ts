import { Schemas } from '@xata.io/client';

export const isBranchPgRollEnabled = (details: Schemas.DBBranch) => {
  // @ts-expect-error TODO: Fix this when api is finalized
  return !!details.usePgRoll;
};

export const isMigrationPgRollFormat = (
  migration: Schemas.MigrationObject | Schemas.PgRollMigrationHistoryItem
): migration is Schemas.PgRollMigrationHistoryItem => {
  return 'migration' in migration;
};
