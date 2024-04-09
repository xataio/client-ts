import { XataApiClient } from '@xata.io/client';

export async function waitForMigrationToFinish(
  api: XataApiClient,
  workspace: string,
  region: string,
  database: string,
  branch: string,
  jobId: string
) {
  const { status, error } = await api.migrations.getMigrationJobStatus({
    pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, jobId }
  });
  if (status === 'failed') {
    throw new Error(`Migration failed, ${error}`);
  }

  if (status === 'completed') {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await waitForMigrationToFinish(api, workspace, region, database, branch, jobId);
}
