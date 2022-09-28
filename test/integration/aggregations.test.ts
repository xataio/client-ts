import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { mockUsers } from '../mock_data';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('aggregations');

  xata = result.client;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  await xata.db.users.create(mockUsers);

  const ownerAnimals = await xata.db.users.filter('full_name', 'Owner of team animals').getFirst();
  const ownerFruits = await xata.db.users.filter('full_name', 'Owner of team fruits').getFirst();
  if (!ownerAnimals || !ownerFruits) {
    throw new Error('Could not find owner of team animals or owner of team fruits');
  }

  await xata.db.teams.create({
    name: 'Team fruits',
    labels: ['apple', 'banana', 'orange'],
    owner: ownerFruits
  });

  await xata.db.teams.create({
    name: 'Team animals',
    labels: ['monkey', 'lion', 'eagle', 'dolphin'],
    owner: ownerAnimals
  });

  await xata.db.teams.create({
    name: 'Mixed team fruits & animals',
    labels: ['monkey', 'banana', 'apple', 'dolphin']
  });

  await waitForSearchIndexing();
});

afterAll(async (ctx) => {
  await hooks.afterAll(ctx);
});

beforeEach(async (ctx) => {
  await hooks.beforeEach(ctx);
});

afterEach(async (ctx) => {
  await hooks.afterEach(ctx);
});

describe('aggregations', () => {
  test('no body', async () => {
    const result = await xata.db.teams.aggregate();
    expect(result.aggs.count).toBe(3);
  });

  test('simple total and unique counts', async () => {
    const result = await xata.db.teams.aggregate({
      total: { count: '*' },
      unique: { uniqueCount: { column: 'name' } }
    });

    expect(result.aggs.total).toBe(3);
    expect(result.aggs.unique).toBe(3);
  });

  test('count and unique count with global filter', async () => {
    const result = await xata.db.teams.aggregate(
      {
        total: { count: '*' },
        unique: { uniqueCount: { column: 'name' } }
      },
      { name: 'Team fruits' }
    );

    expect(result.aggs.total).toBe(1);
    expect(result.aggs.unique).toBe(1);
  });

  test('counts with filters', async () => {
    const result = await xata.db.teams.aggregate({
      total: { count: '*', filter: { name: 'Team fruits' } }
    });

    expect(result.aggs.total).toBe(1);
  });
});

async function waitForSearchIndexing(): Promise<void> {
  const { users = [], teams = [] } = await xata.search.byTable('fruits');
  if (users.length === 0 || teams.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return waitForSearchIndexing();
  }
}
