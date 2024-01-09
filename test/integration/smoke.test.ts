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

    const newApiKey = await api.authentication.createUserAPIKey({ pathParams: { keyName: `${workspaceName}-key` } });

    expect(newApiKey).toBeDefined();
    expect(newApiKey.name).toBe(`${workspaceName}-key`);
    expect(newApiKey.key).toBeDefined();

    const newApi = new XataApiClient({ apiKey: newApiKey.key, host });

    const { id: workspace, name } = await newApi.workspaces.createWorkspace({
      body: { name: workspaceName, slug: `${workspaceName}-slug` }
    });

    await waitForReplication(newApi, workspace);

    expect(workspace).toBeDefined();
    expect(name).toBe(workspaceName);

    console.log('Created workspace', workspace);

    const foo = await newApi.workspaces.getWorkspace({ pathParams: { workspaceId: workspace } });

    expect(foo.id).toBe(workspace);
    expect(foo.slug).toBe(`${workspaceName}-slug`);

    const bar = await newApi.workspaces.getWorkspace({ pathParams: { workspaceId: workspace } });

    expect(bar.id).toBe(workspace);
    expect(bar.slug).toBe(`${workspaceName}-slug`);

    const { databaseName: database } = await newApi.databases.createDatabase({
      pathParams: { workspaceId: workspace, dbName: `data-${workspace}` },
      body: { region }
    });

    await waitForReplication(newApi, workspace, database);

    console.log('Created database', database);

    await newApi.branch.createBranch({
      pathParams: { workspace, region, dbBranchName: `${database}:branch` }
    });
    await newApi.table.createTable({
      pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table' }
    });
    await newApi.table.setTableSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table' },
      body: { columns: [{ name: 'email', type: 'string' }] }
    });

    console.log('Created branch, table and schema');

    const { id } = await newApi.records.insertRecord({
      pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table' },
      body: { email: 'example@foo.bar' }
    });

    console.log('Created record', id);

    const record = await newApi.records.getRecord({
      pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table', recordId: id }
    });

    expect(record.id).toBeDefined();
    expect(record.email).toEqual('example@foo.bar');

    await waitForSearchIndexing(newApi, workspace, database);

    const search = await newApi.searchAndFilter.searchTable({
      pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table' },
      body: { query: 'example' }
    });

    expect(search.totalCount).toEqual(1);
    expect(search.records[0].id).toEqual(id);

    const failedSearch = await newApi.searchAndFilter.searchTable({
      pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table' },
      body: { query: 'random' }
    });

    expect(failedSearch.totalCount).toEqual(0);
    expect(failedSearch.records).toEqual([]);

    console.log('Tested search successfully');

    await api.authentication.deleteUserAPIKey({ pathParams: { keyName: newApiKey.name } });

    await waitFailInReplication(newApi, workspace, database);

    await expect(
      newApi.records.getRecord({
        pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table', recordId: id }
      })
    ).rejects.toHaveProperty('message');

    console.log('Deleted API key, record is no longer accessible');

    await api.workspaces.deleteWorkspace({ pathParams: { workspaceId: workspace } });

    await expect(api.workspaces.getWorkspace({ pathParams: { workspaceId: workspace } })).rejects.toHaveProperty(
      'message'
    );
  });
});

async function waitForReplication(api: XataApiClient, workspace: string, database?: string): Promise<void> {
  try {
    if (database === undefined) {
      await api.databases.getDatabaseList({ pathParams: { workspaceId: workspace } });
    } else {
      await api.branch.getBranchList({ pathParams: { workspace, region, dbName: database } });
    }
  } catch (error) {
    console.log(`Waiting for create ${database === undefined ? 'API key' : 'database'} replication to finish...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitForReplication(api, workspace, database);
  }
}

async function waitFailInReplication(api: XataApiClient, workspace: string, database: string): Promise<void> {
  try {
    await api.branch.getBranchList({ pathParams: { workspace, region, dbName: database } });

    console.log(`Waiting for delete API key replication to finish...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitFailInReplication(api, workspace, database);
  } catch (error) {
    // Do nothing, we expect to fail
  }
}

async function waitForSearchIndexing(api: XataApiClient, workspace: string, database: string): Promise<void> {
  try {
    const { aggs } = await api.searchAndFilter.aggregateTable({
      pathParams: { workspace, region, dbBranchName: `${database}:branch`, tableName: 'table' },
      body: { aggs: { total: { count: '*' } } }
    });

    if (aggs?.total === 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return;
    }
  } catch (error) {
    // do nothing
  }

  console.log(`Waiting for search indexing to finish...`);
  await new Promise((resolve) => setTimeout(resolve, 8000));
  return waitForSearchIndexing(api, workspace, database);
}
