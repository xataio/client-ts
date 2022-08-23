import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { BaseClientOptions, SimpleCache } from '../../packages/client/src';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

const cache = new SimpleCache();

let xata: XataClient;
let clientOptions: BaseClientOptions;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('cache', { cache });

  xata = result.client;
  clientOptions = result.clientOptions;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);
});

afterAll(async (ctx) => {
  await hooks.afterAll(ctx);
});

beforeEach(async (ctx) => {
  await hooks.beforeEach(ctx);
});

afterEach(async (ctx) => {
  await cache.clear();
  await hooks.afterEach(ctx);
});

describe('cache', () => {
  test('query with ttl', async () => {
    const user = await xata.db.users.create({ full_name: 'John Doe' });

    await cache.clear();

    await xata.db.users.filter({ id: user.id }).getFirst();

    const cacheItems = Object.entries(await cache.getAll());
    expect(Object.keys(cacheItems)).toHaveLength(1);

    const [cacheKey, value] = cacheItems[0] as any;
    const cacheItem = await cache.get<any>(cacheKey);
    expect(cacheItem).not.toBeNull();
    expect(cacheItem?.records[0]?.full_name).toBe('John Doe');

    await cache.set(cacheKey, { ...value, records: [{ ...user, full_name: 'Jane Doe' }] });

    const query = await xata.db.users.filter({ id: user.id }).getFirst({ cache: 120000 });
    expect(query?.full_name).toBe('Jane Doe');
  });

  test('query with expired ttl', async () => {
    const user = await xata.db.users.create({ full_name: 'John Doe' });

    await cache.clear();

    await xata.db.users.filter({ id: user.id }).getFirst();

    const cacheItems = Object.entries(await cache.getAll());
    expect(cacheItems).toHaveLength(1);

    const [key, value] = cacheItems[0] as any;

    await cache.set(key, { ...value, records: [{ ...user, full_name: 'Jane Doe' }] });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const query = await xata.db.users.filter({ id: user.id }).getFirst({ cache: 500 });
    expect(query?.full_name).toBe('John Doe');
  });

  test("query with negative ttl doesn't cache", async () => {
    const user = await xata.db.users.create({ full_name: 'John Doe' });

    await cache.clear();

    await xata.db.users.filter({ id: user.id }).getFirst();

    const cacheItems = Object.entries(await cache.getAll());
    expect(cacheItems).toHaveLength(1);

    const [key, value] = cacheItems[0] as any;

    await cache.set(key, { ...value, records: [{ ...user, full_name: 'Jane Doe' }] });

    const query = await xata.db.users.filter({ id: user.id }).getFirst({ cache: -1 });
    expect(query?.full_name).toBe('John Doe');
  });

  test('no cache', async () => {
    const client1 = new XataClient({ ...clientOptions, cache: undefined });
    const client2 = new XataClient({ ...clientOptions, cache: undefined });

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
