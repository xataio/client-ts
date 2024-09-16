import { XataClient } from '../base';

export function isActiveMigration(
  jobStatus: Awaited<ReturnType<XataClient['api']['migrations']['getBranchMigrationJobStatus']>>
) {
  const isActiveMigration = jobStatus.status === 'completed' && jobStatus.type === 'start';
  return isActiveMigration;
}
