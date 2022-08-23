import realFetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { vi } from 'vitest';
import { BaseClient, CacheImpl, XataApiClient } from '../../packages/client/src';
import { getHostUrl, HostProvider, isHostProviderAlias } from '../../packages/client/src/api/providers';
import { XataClient } from '../../packages/codegen/example/xata';
import { teamColumns, userColumns } from '../mock_data';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const apiKey = process.env.XATA_API_KEY ?? '';
if (apiKey === '') throw new Error('XATA_API_KEY environment variable is not set');

const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const host = getProvider(process.env.XATA_API_PROVIDER);
const fetch = vi.fn(realFetch);

export type EnvironmentOptions = {
  cache?: CacheImpl;
};

export type TestEnvironmentResult = {
  api: XataApiClient;
  client: XataClient;
  cleanup: () => Promise<void>;
  clientOptions: {
    databaseURL: string;
    fetch: typeof fetch;
    apiKey: string;
    branch: string;
    cache?: CacheImpl;
  };
};

export async function setUpTestEnvironment(prefix: string, { cache }: EnvironmentOptions = {}) {
  const id = Math.round(Math.random() * 100000);

  const api = new XataApiClient({ apiKey, fetch, host });
  const { databaseName: database } = await api.databases.createDatabase(
    workspace,
    `sdk-integration-test-${prefix}-${id}`
  );

  const workspaceUrl = getHostUrl(host, 'workspaces').replace('{workspaceId}', workspace);

  const clientOptions = {
    databaseURL: `${workspaceUrl}/db/${database}`,
    branch: 'main',
    apiKey,
    fetch,
    cache
  };

  await api.tables.createTable(workspace, database, 'main', 'teams');
  await api.tables.createTable(workspace, database, 'main', 'users');
  await api.tables.setTableSchema(workspace, database, 'main', 'teams', { columns: teamColumns });
  await api.tables.setTableSchema(workspace, database, 'main', 'users', { columns: userColumns });

  const cleanup = async () => {
    await api.databases.deleteDatabase(workspace, database);
  };

  const client = new XataClient(clientOptions);
  const baseClient = new BaseClient(clientOptions);

  return { api, client, baseClient, clientOptions, database, workspace, cleanup };
}

function getProvider(provider = 'production'): HostProvider {
  if (isHostProviderAlias(provider)) {
    return provider;
  }

  const [main, workspaces] = provider.split(',');
  if (!main || !workspaces) {
    throw new Error(
      `Invalid XATA_API_PROVIDER environment variable, expected either "production", "staging" or "apiUrl,workspacesUrl"`
    );
  }
  return { main, workspaces };
}
