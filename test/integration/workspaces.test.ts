import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { describe, expect, test } from 'vitest';
import { getWorkspace, parseProviderString, Schemas, XataApiClient } from '../../packages/client/src';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const host = parseProviderString(process.env.XATA_API_PROVIDER);
if (host === null) {
  throw new Error(
    `Invalid XATA_API_PROVIDER environment variable, expected either "production", "staging" or "apiUrl,workspacesUrl"`
  );
}

const api = new XataApiClient({ fetch, apiKey: process.env.XATA_API_KEY, host });
const region = process.env.XATA_REGION || 'eu-west-1';

const getWorkspaceName = () => `sdk-integration-api-client-${Math.random().toString(36).substr(2, 9)}`;

describe('API Client Integration Tests', () => {
  test('Create, get and delete workspace with new apiKey', async () => {
    const workspaceName = getWorkspaceName();

    const newApiKey = await api.authentication.createUserAPIKey({ name: `${workspaceName}-key` });

    expect(newApiKey).toBeDefined();
    expect(newApiKey.name).toBe(`${workspaceName}-key`);
    expect(newApiKey.key).toBeDefined();

    const newApi = new XataApiClient({ fetch, apiKey: newApiKey.key, host });

    const { id: workspace, name } = await newApi.workspaces.createWorkspace({
      data: { name: workspaceName, slug: `${workspaceName}-slug` }
    });

    await waitForReplication(newApi, workspace);

    expect(workspace).toBeDefined();
    expect(name).toBe(workspaceName);

    const foo = await newApi.workspaces.getWorkspace({ workspace });

    expect(foo.id).toBe(workspace);
    expect(foo.slug).toBe(`${workspaceName}-slug`);

    const bar = await newApi.workspaces.getWorkspace({ workspace });

    expect(bar.id).toBe(workspace);
    expect(bar.slug).toBe(`${workspaceName}-slug`);

    const { databaseName: database } = await newApi.database.createDatabase({
      workspace,
      database: `data-${workspace}`,
      data: { region }
    });

    await waitForReplication(newApi, workspace, database);

    await newApi.branches.createBranch({ workspace, region, database, branch: 'branch' });
    await newApi.tables.createTable({ workspace, region, database, branch: 'branch', table: 'table' });
    await newApi.tables.setTableSchema({
      workspace,
      region,
      database,
      branch: 'branch',
      table: 'table',
      schema: { columns: [{ name: 'email', type: 'string' }] }
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
      database,
      branch: 'branch',
      table: 'table',
      id
    });

    expect(record.id).toBeDefined();
    expect(record.email).toEqual('example@foo.bar');

    await api.authentication.deleteUserAPIKey({ name: newApiKey.name });

    await waitFailInReplication(newApi, workspace, database);

    await expect(
      newApi.records.getRecord({
        workspace,
        region,
        database,
        branch: 'branch',
        table: 'table',
        id
      })
    ).rejects.toHaveProperty('message');

    await api.workspaces.deleteWorkspace({ workspace });

    await expect(api.workspaces.getWorkspace({ workspace })).rejects.toHaveProperty('message');
  });

  test('Create workspace with database, branch, table and records', async () => {
    const workspaceName = getWorkspaceName();

    const { id: workspace } = await api.workspaces.createWorkspace({
      data: { name: workspaceName, slug: workspaceName }
    });

    await waitForReplication(api, workspace);

    const { databaseName: database } = await api.database.createDatabase({
      workspace,
      database: `data-${workspace}`,
      data: { region }
    });

    await waitForReplication(api, workspace, database);

    await api.branches.createBranch({ workspace, region, database, branch: 'branch' });
    await api.tables.createTable({ workspace, region, database, branch: 'branch', table: 'table' });
    await api.tables.setTableSchema({
      workspace,
      region,
      database,
      branch: 'branch',
      table: 'table',
      schema: { columns: [{ name: 'email', type: 'string' }] }
    });

    const { id } = await api.records.insertRecord({
      workspace,
      region,
      database,
      branch: 'branch',
      table: 'table',
      record: { email: 'example@foo.bar' }
    });

    const record = await api.records.getRecord({ workspace, region, database, branch: 'branch', table: 'table', id });

    expect(record.id).toBeDefined();
    expect(record.email).toEqual('example@foo.bar');

    await api.workspaces.deleteWorkspace({ workspace });
  });
});

async function waitForReplication(api: XataApiClient, workspace: string, database?: string): Promise<void> {
  try {
    if (database === undefined) {
      await api.database.getDatabaseList({ workspace });
    } else {
      await api.branches.getBranchList({ workspace, database, region });
    }
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitForReplication(api, workspace, database);
  }
}

async function waitFailInReplication(api: XataApiClient, workspace: string, database: string): Promise<void> {
  try {
    await api.branches.getBranchList({ workspace, database, region });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitFailInReplication(api, workspace, database);
  } catch (error) {
    // Do nothing, we expect to fail
  }
}
