import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { SimpleCache, XataApiClient } from '../../packages/client/src';
import { User, XataClient } from '../../packages/codegen/example/xata';
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

const cache = new SimpleCache();

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

afterEach(async () => {
  await cache.clear();
});

describe('cache', () => {
  test('miss - set, get and remove', async () => {
    const user = await client.db.users.create({ full_name: 'John Doe' });

    const cachedItem = await cache.get<User>(`rec_users:${user.id}`);
    expect(cachedItem?.full_name).toBe('John Doe');

    await client.db.users.read(user.id);

    const cachedItem2 = await cache.get<User>(`rec_users:${user.id}`);
    expect(cachedItem2?.full_name).toBe('John Doe');

    await user.delete();

    const cachedItem3 = await cache.get<User>(`rec_users:${user.id}`);
    expect(cachedItem3).toBeNull();
  });

  test('hit - get, set and remove', async () => {
    await cache.set('rec_users:foo', { id: 'foo', full_name: 'John Doe', xata: { version: 1 } });
    const user = await client.db.users.read('foo');

    expect(user?.id).toBe('foo');
    expect(user?.full_name).toBe('John Doe');

    const update = await client.db.users.createOrUpdate('foo', { full_name: 'John Smith' });

    const cachedItem = await cache.get<User>('rec_users:foo');

    expect(cachedItem?.full_name).toBe('John Smith');

    await update.delete();

    const allCache = await cache.getAll();
    expect(allCache).toEqual({});
  });

  test('query invalidated', async () => {
    const user = await client.db.users.create({ full_name: 'Jane Doe' });

    const cachedQueries0 = await cache
      .getAll()
      .then((cache) => Object.entries(cache).filter(([key]) => key.startsWith('query_')));

    expect(cachedQueries0).toHaveLength(0);

    const query1 = await client.db.users.filter({ id: user.id }).getFirst();

    const cachedQueries1 = await cache
      .getAll()
      .then((cache) => Object.entries(cache).filter(([key]) => key.startsWith('query_')));

    expect(cachedQueries1).toHaveLength(1);

    expect(query1?.id).toBe(user.id);
    expect(query1?.full_name).toBe('Jane Doe');

    await user.update({ full_name: 'Jane Smith' });

    const query2 = await client.db.users.filter({ id: user.id }).getFirst();

    const cachedQueries2 = await cache
      .getAll()
      .then((cache) => Object.entries(cache).filter(([key]) => key.startsWith('query_')));

    expect(cachedQueries2).toHaveLength(1);

    expect(query2?.id).toBe(user.id);
    expect(query2?.full_name).toBe('Jane Smith');
  });

  test('query invalidated with nested object', async () => {
    const owner = await client.db.users.create({ full_name: 'John Smith' });
    const team = await client.db.teams.create({ name: 'Team 1', owner });
    const member = await client.db.users.create({ full_name: 'Jane Doe', team });

    expect(await cache.getAll().then(Object.entries)).toHaveLength(3);

    const query = await client.db.users.filter('id', member.id).select(['*', 'team.owner.full_name']).getFirst();
    expect(query?.team?.owner?.full_name).toBe('John Smith');

    expect(await cache.getAll().then(Object.entries)).toHaveLength(4);

    await owner.update({ full_name: 'John Doe' });

    expect(await cache.getAll().then(Object.entries)).toHaveLength(3);
  });

  test('query with ttl', async () => {
    const user = await client.db.users.create({ full_name: 'John Doe' });

    await cache.clear();

    await client.db.users.filter({ id: user.id }).getFirst();

    const cacheItems = Object.entries(await cache.getAll());
    expect(Object.keys(cacheItems)).toHaveLength(1);

    const [cacheKey, value] = cacheItems[0] as any;
    const cacheItem = await cache.get<any>(cacheKey);
    expect(cacheItem).not.toBeNull();
    expect(cacheItem?.records[0]?.full_name).toBe('John Doe');

    await cache.set(cacheKey, { ...value, records: [{ ...user, full_name: 'Jane Doe' }] });

    const query = await client.db.users.filter({ id: user.id }).getFirst({ cache: 120000 });
    expect(query?.full_name).toBe('Jane Doe');
  });

  test('query with expired ttl', async () => {
    const user = await client.db.users.create({ full_name: 'John Doe' });

    await cache.clear();

    await client.db.users.filter({ id: user.id }).getFirst();

    const cacheItems = Object.entries(await cache.getAll());
    expect(cacheItems).toHaveLength(1);

    const [key, value] = cacheItems[0] as any;

    await cache.set(key, { ...value, records: [{ ...user, full_name: 'Jane Doe' }] });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const query = await client.db.users.filter({ id: user.id }).getFirst({ cache: 500 });
    expect(query?.full_name).toBe('John Doe');
  });

  test("query with negative ttl doesn't cache", async () => {
    const user = await client.db.users.create({ full_name: 'John Doe' });

    await cache.clear();

    await client.db.users.filter({ id: user.id }).getFirst();

    const cacheItems = Object.entries(await cache.getAll());
    expect(cacheItems).toHaveLength(1);

    const [key, value] = cacheItems[0] as any;

    await cache.set(key, { ...value, records: [{ ...user, full_name: 'Jane Doe' }] });

    const query = await client.db.users.filter({ id: user.id }).getFirst({ cache: -1 });
    expect(query?.full_name).toBe('John Doe');
  });

  test('no cache', async () => {
    const client1 = new XataClient({
      databaseURL: `https://${workspace}.xata.sh/db/${databaseName}`,
      branch: 'main',
      apiKey: process.env.XATA_API_KEY || '',
      fetch
    });

    const client2 = new XataClient({
      databaseURL: `https://${workspace}.xata.sh/db/${databaseName}`,
      branch: 'main',
      apiKey: process.env.XATA_API_KEY || '',
      fetch
    });

    const teamsA1 = await client1.db.teams.getAll();
    const teamsA2 = await client2.db.teams.getAll();

    expect(teamsA1).toHaveLength(teamsA2.length);

    await client2.db.teams.create({});

    const teamsB1 = await client1.db.teams.getAll();
    const teamsB2 = await client2.db.teams.getAll();

    expect(teamsB1).toHaveLength(teamsB2.length);
    expect(teamsB1).toHaveLength(teamsA1.length + 1);
    expect(teamsB2).toHaveLength(teamsA2.length + 1);
  });
});
