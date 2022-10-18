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
    const { id: workspace, name } = await api.workspaces.createWorkspace({
      data: { name: 'foo', slug: 'foo' }
    });

    expect(workspace).toBeDefined();
    expect(name).toBe('foo');

    const foo = await api.workspaces.getWorkspace({ workspace });

    expect(foo.id).toBe(workspace);
    expect(foo.slug).toBe('foo');

    await api.workspaces.deleteWorkspace({ workspace });

    await expect(api.workspaces.getWorkspace({ workspace })).rejects.toHaveProperty('message');
  });

  test('Create workspace with database, branch, table and records', async () => {
    const { id: workspace } = await api.workspaces.createWorkspace({
      data: {
        name: 'sdk-integration-api-client',
        slug: 'sdk-integration-api-client'
      }
    });

    const { databaseName: database } = await api.database.createDatabase({
      workspace,
      database: `test-data-${workspace}`,
      data: { region }
    });

    await waitForReplication(workspace, database);

    await api.branches.createBranch({ workspace, database, branch: 'branch' });
    await api.tables.createTable({ workspace, database, branch: 'branch', table: 'table' });
    await api.tables.setTableSchema({
      workspace,
      database,
      branch: 'branch',
      table: 'table',
      schema: { columns: [{ name: 'email', type: 'string' }] }
    });

    const { id } = await api.records.insertRecord({
      workspace,
      database,
      branch: 'branch',
      table: 'table',
      record: { email: 'example@foo.bar' }
    });

    const record = await api.records.getRecord({ workspace, database, branch: 'branch', table: 'table', id });

    expect(record.id).toBeDefined();
    expect(record.email).toEqual('example@foo.bar');

    await api.workspaces.deleteWorkspace({ workspace });
  });
});

async function waitForReplication(workspace: string, database: string): Promise<void> {
  try {
    await api.branches.getBranchList({ workspace, database });
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitForReplication(workspace, database);
  }
}
