import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { describe, expect, test } from 'vitest';
import { parseProviderString, Schemas, XataApiClient } from '../packages/client/src';

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

describe('API Client Integration Tests', () => {
  test('Create, get and delete workspace', async () => {
    const workspace = await api.workspaces.createWorkspace({
      name: 'foo',
      slug: 'foo'
    });

    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe('foo');

    const foo = await getWorkspace(workspace.id);
    expect(foo.id).toBe(workspace.id);
    expect(foo.slug).toBe('foo');

    await api.workspaces.deleteWorkspace(workspace.id);

    await expect(api.workspaces.getWorkspace(workspace.id)).rejects.toHaveProperty('message');
  });

  test('Create workspace with database, branch, table and records', async () => {
    const { id: workspace } = await api.workspaces.createWorkspace({
      name: 'sdk-integration-api-client',
      slug: 'sdk-integration-api-client'
    });

    await getWorkspace(workspace);

    const { databaseName } = await api.database.createDatabase(workspace, `test-data-${workspace}`, { region });

    await api.branches.createBranch(workspace, databaseName, 'branch');
    await api.tables.createTable(workspace, databaseName, 'branch', 'table');
    await api.tables.setTableSchema(workspace, databaseName, 'branch', 'table', {
      columns: [{ name: 'email', type: 'string' }]
    });

    const { id: recordId } = await api.records.insertRecord(workspace, databaseName, 'branch', 'table', {
      email: 'example@foo.bar'
    });

    const record = await api.records.getRecord(workspace, databaseName, 'branch', 'table', recordId);

    expect(record.id).toBeDefined();
    expect(record.email).toEqual('example@foo.bar');

    await api.workspaces.deleteWorkspace(workspace);
  });
});

async function getWorkspace(id: string): Promise<Schemas.Workspace> {
  try {
    const result = await api.workspaces.getWorkspace(id);
    return result;
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return getWorkspace(id);
  }
}
