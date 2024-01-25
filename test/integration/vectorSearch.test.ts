import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

const users = [
  { full_name: 'r1', vector: [0.1, 0.2, 0.3, 0.6] },
  { full_name: 'r2', vector: [4, 3, 2, 1] },
  { full_name: 'r3', vector: [0.5, 0.2, 0.3, 0.1] },
  { full_name: 'r4', vector: [1, 2, 3, 4] }
];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('vectorSearch');

  xata = result.client;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  await xata.db.users.create(users);

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

describe(
  'search',
  () => {
    test('search 1 2 3 4', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [1, 2, 3, 4]);

      expect(totalCount).toEqual(4);
      expect(results.map((r) => r.full_name)).toEqual(['r4', 'r1', 'r2', 'r3']);
    });

    test('search 0.4 0.3 0.2 0.1', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [0.4, 0.3, 0.2, 0.1]);

      expect(totalCount).toEqual(4);
      expect(results.map((r) => r.full_name)).toEqual(['r2', 'r3', 'r4', 'r1']);
    });

    test('with size', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [1, 2, 3, 4], { size: 2 });

      // The total count may be higher than the size
      expect(totalCount).toEqual(4);
      expect(results.map((r) => r.full_name)).toEqual(['r4', 'r1']);
    });

    test('with filter', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [1, 2, 3, 4], {
        filter: { full_name: { $any: ['r3', 'r4'] } }
      });

      expect(totalCount).toEqual(2);
      expect(results.map((r) => r.full_name)).toEqual(['r4', 'r3']);
    });

    test('euclidean', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [1, 2, 3, 4], {
        similarityFunction: 'l1'
      });

      expect(totalCount).toEqual(4);
      expect(results.map((r) => r.full_name)).toEqual(['r4', 'r2', 'r1', 'r3']);
    });

    test('larger size', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [1, 2, 3, 4], { size: 100 });

      expect(totalCount).toEqual(4);
      expect(results.map((r) => r.full_name)).toEqual(['r4', 'r1', 'r2', 'r3']);
    });

    test('with filter and size', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [1, 2, 3, 4], {
        filter: { full_name: { $any: ['r3', 'r4'] } },
        size: 1
      });

      expect(totalCount).toEqual(2);
      expect(results.map((r) => r.full_name)).toEqual(['r4']);
    });

    test('with filter and size and spaceFunction', async () => {
      const { records: results, totalCount } = await xata.db.users.vectorSearch('vector', [1, 2, 3, 4], {
        filter: { full_name: { $any: ['r3', 'r4'] } },
        size: 1,
        similarityFunction: 'l1'
      });

      expect(totalCount).toEqual(2);
      expect(results.map((r) => r.full_name)).toEqual(['r4']);
    });
  },
  { retry: 5 }
);

async function waitForSearchIndexing(): Promise<void> {
  try {
    const { aggs: userAggs } = await xata.db.users.aggregate({ total: { count: '*' } });
    if (userAggs.total === users.length) {
      return;
    }
  } catch (error) {
    // do nothing
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
  return waitForSearchIndexing();
}
