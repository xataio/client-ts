import dotenv from 'dotenv';
import { join } from 'path';
import { describe, expect, test } from 'vitest';
import { parseProviderString, XataApiClient } from '../../packages/client/src';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const host = parseProviderString(process.env.XATA_API_PROVIDER);
if (host === null) {
  throw new Error(
    `Invalid XATA_API_PROVIDER environment variable, expected either "production", "staging" or "apiUrl,workspacesUrl"`
  );
}

const api = new XataApiClient({ apiKey: process.env.XATA_API_KEY, host });
const region = process.env.XATA_REGION || 'eu-west-1';

const getWorkspaceName = () => `sdk-integration-api-client-${Math.random().toString(36).substr(2, 9)}`;

describe('API Client Integration Tests', () => {
  test('Create, get and delete workspace with new apiKey', async () => {
    const workspaceName = getWorkspaceName();

    const newApiKey = await api.authentication.createUserAPIKey({ keyName: `${workspaceName}-key` });

    expect(newApiKey).toBeDefined();
    expect(newApiKey.name).toBe(`${workspaceName}-key`);
    expect(newApiKey.key).toBeDefined();

    const newApi = new XataApiClient({ apiKey: newApiKey.key, host });

    const { id: workspace, name } = await newApi.workspaces.createWorkspace({
      name: workspaceName,
      slug: `${workspaceName}-slug`
    });

    await waitForReplication(newApi, workspace);

    expect(workspace).toBeDefined();
    expect(name).toBe(workspaceName);

    const foo = await newApi.workspaces.getWorkspace({ workspaceId: workspace });

    expect(foo.id).toBe(workspace);
    expect(foo.slug).toBe(`${workspaceName}-slug`);

    const bar = await newApi.workspaces.getWorkspace({ workspaceId: workspace });

    expect(bar.id).toBe(workspace);
    expect(bar.slug).toBe(`${workspaceName}-slug`);

    const { databaseName: database } = await newApi.databases.createDatabase({
      workspaceId: workspace,
      dbName: `data-${workspace}`,
      region
    });

    await waitForReplication(newApi, workspace, database);

    await newApi.branch.createBranch({ workspace, region, dbBranchName: `${database}:branch` });
    await newApi.table.createTable({ workspace, region, dbBranchName: `${database}:branch`, tableName: 'table' });
    await newApi.table.setTableSchema({
      workspace,
      region,
      dbBranchName: `${database}:branch`,
      tableName: 'table',
      columns: [{ name: 'email', type: 'string' }]
    });

    const { id } = await newApi.records.insertRecord({
      workspace,
      region,
      database,
      branch: 'branch',
      table: 'table',
      record: { email: 'example@foo.bar' }
    });

    const record = await newApi.records.getRecord({
      workspace,
      region,
      dbBranchName: `${database}:branch`,
      tableName: 'table',
      recordId: id
    });

    expect(record.id).toBeDefined();
    expect(record.email).toEqual('example@foo.bar');

    await waitForSearchIndexing(newApi, workspace, database);

    const search = await newApi.searchAndFilter.searchTable({
      workspace,
      region,
      dbBranchName: `${database}:branch`,
      tableName: 'table',
      query: 'example'
    });

    expect(search.totalCount).toEqual(1);
    expect(search.records[0].id).toEqual(id);

    const failedSearch = await newApi.searchAndFilter.searchTable({
      workspace,
      region,
      dbBranchName: `${database}:branch`,
      tableName: 'table',
      query: 'random'
    });

    expect(failedSearch.totalCount).toEqual(0);
    expect(failedSearch.records).toEqual([]);

    await api.authentication.deleteUserAPIKey({ keyName: newApiKey.name });

    await waitFailInReplication(newApi, workspace, database);

    await expect(
      newApi.records.getRecord({
        workspace,
        region,
        dbBranchName: `${database}:branch`,
        tableName: 'table',
        recordId: id
      })
    ).rejects.toHaveProperty('message');

    await api.workspaces.deleteWorkspace({ workspaceId: workspace });

    await expect(api.workspaces.getWorkspace({ workspaceId: workspace })).rejects.toHaveProperty('message');
  });
});

async function waitForReplication(api: XataApiClient, workspace: string, database?: string): Promise<void> {
  try {
    if (database === undefined) {
      await api.databases.getDatabaseList({ workspaceId: workspace });
    } else {
      await api.branch.getBranchList({ workspace, region, dbName: database });
    }
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitForReplication(api, workspace, database);
  }
}

async function waitFailInReplication(api: XataApiClient, workspace: string, database: string): Promise<void> {
  try {
    await api.branch.getBranchList({ workspace, region, dbName: database });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitFailInReplication(api, workspace, database);
  } catch (error) {
    // Do nothing, we expect to fail
  }
}

async function waitForSearchIndexing(api: XataApiClient, workspace: string, database: string): Promise<void> {
  try {
    const { aggs } = await api.searchAndFilter.aggregateTable({
      workspace,
      region,
      dbBranchName: `${database}:branch`,
      tableName: 'table',
      aggs: { total: { count: '*' } }
    });

    if (aggs?.total === 1) return;
  } catch (error) {
    // do nothing
  }
  await new Promise((resolve) => setTimeout(resolve, 8000));
  return waitForSearchIndexing(api, workspace, database);
}
