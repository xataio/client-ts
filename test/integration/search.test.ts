import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Teams, XataClient } from '../../packages/codegen/example/xata';
import { mockUsers as users } from '../mock_data';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

let teams: Partial<Teams>[];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('search');

  xata = result.client;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  await xata.db.users.create(users);

  const ownerAnimals = await xata.db.users.filter('full_name', 'Owner of team animals').getFirst();
  const ownerFruits = await xata.db.users.filter('full_name', 'Owner of team fruits').getFirst();
  if (!ownerAnimals || !ownerFruits) {
    throw new Error('Could not find owner of team animals or owner of team fruits');
  }

  teams = [
    {
      name: 'Team fruits',
      labels: ['apple', 'banana', 'orange'],
      owner: ownerFruits
    },
    {
      name: 'Team animals',
      labels: ['monkey', 'lion', 'eagle', 'dolphin'],
      owner: ownerAnimals
    },
    {
      name: 'Mixed team fruits & animals',
      labels: ['monkey', 'banana', 'apple', 'dolphin']
    }
  ];

  await xata.db.teams.create(teams);

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
    test('search in table', async () => {
      const { records, totalCount } = await xata.db.users.search('Owner');
      expect(totalCount).toBe(2);
      expect(records.length).toBeGreaterThan(0);

      expect(records.length).toBe(2);
      expect(records[0].id).toBeDefined();
      expect(records[0].full_name?.includes('Owner')).toBeTruthy();
      expect(records[0].read).toBeDefined();
      expect(records[0].getMetadata().score).toBeDefined();
      expect(records[0].getMetadata().table).toBe('users');
    });

    test('search in table with filtering', async () => {
      const { records, totalCount } = await xata.db.users.search('Owner', {
        filter: { full_name: 'Owner of team animals' }
      });

      expect(totalCount).toBe(1);
      expect(records.length).toBe(1);
      expect(records[0].id).toBeDefined();
      expect(records[0].full_name?.includes('Owner of team animals')).toBeTruthy();
      expect(records[0].read).toBeDefined();
      expect(records[0].getMetadata().score).toBeDefined();
    });

    test('search by tables with multiple tables', async () => {
      const {
        records: { users = [], teams = [] },
        totalCount
      } = await xata.search.byTable('fruits', { tables: ['teams', 'users'] });

      expect(totalCount).toBeGreaterThan(0);
      expect(users.length).toBeGreaterThan(0);
      expect(teams.length).toBeGreaterThan(0);

      expect(users[0].id).toBeDefined();
      expect(users[0].read).toBeDefined();
      expect(users[0].full_name?.includes('fruits')).toBeTruthy();
      expect(users[0].getMetadata().score).toBeDefined();

      expect(teams[0].id).toBeDefined();
      expect(teams[0].read).toBeDefined();
      expect(teams[0].name?.includes('fruits')).toBeTruthy();
      expect(users[0].getMetadata().score).toBeDefined();
    });

    test('search by table with all tables', async () => {
      const {
        records: { users = [], teams = [] },
        totalCount
      } = await xata.search.byTable('fruits');

      expect(totalCount).toBeGreaterThan(0);
      expect(users.length).toBeGreaterThan(0);
      expect(teams.length).toBeGreaterThan(0);

      expect(users[0].id).toBeDefined();
      expect(users[0].read).toBeDefined();
      expect(users[0].full_name?.includes('fruits')).toBeTruthy();
      expect(users[0].getMetadata().score).toBeDefined();

      expect(teams[0].id).toBeDefined();
      expect(teams[0].read).toBeDefined();
      expect(teams[0].name?.includes('fruits')).toBeTruthy();
      expect(teams[0].getMetadata().score).toBeDefined();
    });

    test('search all with multiple tables', async () => {
      const { records, totalCount } = await xata.search.all('fruits', { tables: ['teams', 'users'] });
      expect(records).toBeDefined();

      expect(totalCount).toBeGreaterThan(0);
      for (const result of records) {
        if (result.table === 'teams') {
          expect(result.record.id).toBeDefined();
          expect(result.record.read).toBeDefined();
          expect(result.record.name?.includes('fruits')).toBeTruthy();
          expect(result.record.getMetadata().score).toBeDefined();
          expect(result.record.getMetadata().table).toBe('teams');
        } else {
          expect(result.record.id).toBeDefined();
          expect(result.record.read).toBeDefined();
          expect(result.record.full_name?.includes('fruits')).toBeTruthy();
          expect(result.record.getMetadata().table).toBe('users');
          expect(result.record.getMetadata().score).toBeDefined();
        }
      }
    });

    test('search all with one table', async () => {
      const { records, totalCount } = await xata.search.all('fruits', { tables: ['teams'] });
      expect(records).toBeDefined();

      expect(totalCount).toBeGreaterThan(0);
      for (const result of records) {
        expect(result.record.id).toBeDefined();
        expect(result.record.read).toBeDefined();
        expect(result.record.name?.includes('fruits')).toBeTruthy();
        expect(result.record.getMetadata().score).toBeDefined();

        //@ts-expect-error
        result.table === 'users';
      }
    });

    test('search all with all tables', async () => {
      const { records, totalCount } = await xata.search.all('fruits');
      expect(records).toBeDefined();

      expect(totalCount).toBeGreaterThan(0);
      for (const result of records) {
        if (result.table === 'teams') {
          expect(result.record.id).toBeDefined();
          expect(result.record.read).toBeDefined();
          expect(result.record.name?.includes('fruits')).toBeTruthy();
          expect(result.record.getMetadata().score).toBeDefined();
        } else if (result.table === 'users') {
          expect(result.record.id).toBeDefined();
          expect(result.record.read).toBeDefined();
          expect(result.record.full_name?.includes('fruits')).toBeTruthy();
          expect(result.record.getMetadata().score).toBeDefined();
        } else if (result.table === 'pets') {
          expect(result.record.id).toBeDefined();
          expect(result.record.read).toBeDefined();
          expect(result.record.name?.includes('fruits')).toBeTruthy();
          expect(result.record.getMetadata().score).toBeDefined();
        }
      }
    });

    test('search all with filters', async () => {
      const { records, totalCount } = await xata.search.all('fruits', {
        tables: [{ table: 'teams', filter: { name: 'Team fruits' } }]
      });
      expect(records).toBeDefined();

      expect(totalCount).toBe(1);
      expect(records.length).toBe(1);
      expect(records[0].table).toBe('teams');

      if (records[0].table === 'teams') {
        expect(records[0].record.id).toBeDefined();
        expect(records[0].record.read).toBeDefined();
        expect(records[0].record.name?.includes('fruits')).toBeTruthy();
        expect(records[0].record.getMetadata().score).toBeDefined();
      }
    });

    test('search with page and offset', async () => {
      const { records: owners, totalCount } = await xata.db.users.search('Owner');
      const { records: page1, totalCount: page1Count } = await xata.db.users.search('Owner', { page: { size: 1 } });
      const { records: page2, totalCount: page2Count } = await xata.db.users.search('Owner', {
        page: { size: 1, offset: 1 }
      });

      expect(totalCount).toBe(2);
      expect(page1Count).toBe(2);
      expect(page2Count).toBe(2);
      expect(page1.length).toBe(1);
      expect(page2.length).toBe(1);

      expect(page1[0].id).not.toBe(page2[0].id);

      expect(page1[0].id).toBe(owners[0].id);
      expect(page2[0].id).toBe(owners[1].id);
    });

    test('global search with page and offset', async () => {
      const {
        records: { users: owners = [] },
        totalCount
      } = await xata.search.byTable('Owner');
      const {
        records: { users: page1 = [] },
        totalCount: page1Count
      } = await xata.search.byTable('Owner', { page: { size: 1 } });
      const {
        records: { users: page2 = [] },
        totalCount: page2Count
      } = await xata.search.byTable('Owner', {
        page: { size: 1, offset: 1 }
      });

      expect(totalCount).toBe(2);
      expect(page1Count).toBe(2);
      expect(page2Count).toBe(2);
      expect(page1.length).toBe(1);
      expect(page2.length).toBe(1);

      expect(page1[0].id).not.toBe(page2[0].id);

      expect(page1[0].id).toBe(owners[0].id);
      expect(page2[0].id).toBe(owners[1].id);
    });
  },
  { retry: 5 }
);

async function waitForSearchIndexing(): Promise<void> {
  try {
    const { aggs: teamAggs } = await xata.db.teams.aggregate({ total: { count: '*' } });
    const { aggs: userAggs } = await xata.db.users.aggregate({ total: { count: '*' } });
    if (teams !== undefined && teamAggs.total === teams.length && userAggs.total === users.length) {
      return;
    }
  } catch (error) {
    // do nothing
  }
  await new Promise((resolve) => setTimeout(resolve, 8000));
  return waitForSearchIndexing();
}
