import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { CacheImpl, XataApiClient } from '../../packages/client/src';
import { XataClient } from '../../packages/codegen/example/xata';
import { teamColumns, userColumns } from '../mock_data';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.envrc') });

let client: XataClient;
let databaseName: string;

const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const api = new XataApiClient({
  apiKey: process.env.XATA_API_KEY || '',
  fetch
});

class MockCache implements CacheImpl {
  get = vi.fn();
  set = vi.fn();
  delete = vi.fn();
  clear = vi.fn();
}

const cache = new MockCache();

beforeAll(async () => {
  const id = Math.round(Math.random() * 100000);

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-cache-${id}`);
  databaseName = database.databaseName;

  client = new XataClient({
    databaseURL: `https://${workspace}.xata.sh/db/${database.databaseName}`,
    branch: 'main',
    apiKey: process.env.XATA_API_KEY || '',
    fetch,
    cache
  });

  await api.tables.createTable(workspace, databaseName, 'main', 'teams');
  await api.tables.createTable(workspace, databaseName, 'main', 'users');
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'teams', { columns: teamColumns });
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'users', { columns: userColumns });
});

afterAll(async () => {
  await api.databases.deleteDatabase(workspace, databaseName);
});

describe('cache', () => {
  test('miss - set, get and remove', async () => {
    cache.set.mockReset();

    const user = await client.db.users.create({ full_name: 'John Doe' });

    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(`users-${user.id}`, user);

    cache.get.mockReset();

    await client.db.users.read(user.id);

    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(cache.get).toHaveBeenCalledWith(`users-${user.id}`);

    cache.delete.mockReset();

    await user.delete();

    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).toHaveBeenCalledWith(`users-${user.id}`);
  });

  test('hit - get, set and remove', async () => {
    cache.get.mockReset();
    cache.get.mockImplementationOnce(async () => ({ id: 'foo', full_name: 'John Doe', xata: { version: 1 } }));

    const user = await client.db.users.read('foo');

    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(cache.get).toHaveBeenCalledWith('users-foo');
    expect(user?.id).toBe('foo');
    expect(user?.full_name).toBe('John Doe');

    cache.set.mockReset();

    const update = await client.db.users.createOrUpdate('foo', { full_name: 'John Smith' });

    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('users-foo', update);

    cache.delete.mockReset();

    await update.delete();

    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).toHaveBeenCalledWith('users-foo');
  });
});
