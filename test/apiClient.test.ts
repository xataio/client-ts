import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { XataApiClient } from '../client/src';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.envrc') });

const client = new XataApiClient({
  fetch,
  apiKey: process.env.XATA_API_KEY || ''
});

// Integration tests take longer than unit tests, increasing the timeout
jest.setTimeout(50000);

describe('API Client Integration Tests', () => {
  test('Create, get and delete workspace', async () => {
    const workspace = await client.workspaces.createWorkspace({
      name: 'foo',
      slug: 'foo'
    });

    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe('foo');

    const foo = await client.workspaces.getWorkspace(workspace.id);
    expect(foo.id).toBe(workspace.id);
    expect(foo.slug).toBe('foo');

    await client.workspaces.deleteWorkspace(workspace.id);

    await expect(client.workspaces.getWorkspace(workspace.id)).rejects.toHaveProperty(
      'message',
      'no access to the workspace'
    );
  });

  test('Create workspace with database, branch, table and records', async () => {
    const { id: workspace } = await client.workspaces.createWorkspace({
      name: 'sdk-integration-api-client',
      slug: 'sdk-integration-api-client'
    });

    const { databaseName } = await client.databases.createDatabase(workspace, 'database');

    await client.branches.createBranch(workspace, databaseName, 'branch');
    await client.tables.createTable(workspace, databaseName, 'branch', 'table');
    await client.tables.setTableSchema(workspace, databaseName, 'branch', 'table', {
      columns: [{ name: 'email', type: 'string' }]
    });

    const { id: recordId } = await client.records.insertRecord(workspace, databaseName, 'branch', 'table', {
      email: 'example@foo.bar'
    });

    const record = await client.records.getRecord(workspace, databaseName, 'branch', 'table', recordId);

    expect(record.id).toBeDefined();
    expect(record.email).toEqual('example@foo.bar');

    await client.workspaces.deleteWorkspace(workspace);
  });
});
