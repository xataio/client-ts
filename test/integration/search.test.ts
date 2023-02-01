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

describe('search', () => {
  test('search in table', async () => {
    const owners = await xata.db.users.search('Owner');
    expect(owners.length).toBeGreaterThan(0);

    expect(owners.length).toBe(2);
    expect(owners[0].id).toBeDefined();
    expect(owners[0].full_name?.includes('Owner')).toBeTruthy();
    expect(owners[0].read).toBeDefined();
    expect(owners[0].getMetadata().score).toBeDefined();
    expect(owners[0].getMetadata().table).toBe('users');
  });

  test('search in table with filtering', async () => {
    const owners = await xata.db.users.search('Owner', {
      filter: { full_name: 'Owner of team animals' }
    });

    expect(owners.length).toBe(1);
    expect(owners[0].id).toBeDefined();
    expect(owners[0].full_name?.includes('Owner of team animals')).toBeTruthy();
    expect(owners[0].read).toBeDefined();
    expect(owners[0].getMetadata().score).toBeDefined();
  });

  test('search by tables with multiple tables', async () => {
    const { users = [], teams = [] } = await xata.search.byTable('fruits', { tables: ['teams', 'users'] });

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
    const { users = [], teams = [] } = await xata.search.byTable('fruits');

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
    const results = await xata.search.all('fruits', { tables: ['teams', 'users'] });

    for (const result of results) {
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
    const results = await xata.search.all('fruits', { tables: ['teams'] });

    for (const result of results) {
      expect(result.record.id).toBeDefined();
      expect(result.record.read).toBeDefined();
      expect(result.record.name?.includes('fruits')).toBeTruthy();
      expect(result.record.getMetadata().score).toBeDefined();

      //@ts-expect-error
      result.table === 'users';
    }
  });

  test('search all with all tables', async () => {
    const results = await xata.search.all('fruits');

    for (const result of results) {
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
    const results = await xata.search.all('fruits', {
      tables: [{ table: 'teams', filter: { name: 'Team fruits' } }]
    });

    expect(results.length).toBe(1);
    expect(results[0].table).toBe('teams');

    if (results[0].table === 'teams') {
      expect(results[0].record.id).toBeDefined();
      expect(results[0].record.read).toBeDefined();
      expect(results[0].record.name?.includes('fruits')).toBeTruthy();
      expect(results[0].record.getMetadata().score).toBeDefined();
    }
  });

  test.skip('search with page and offset', async () => {
    const owners = await xata.db.users.search('Owner');
    const page1 = await xata.db.users.search('Owner', { page: { size: 1 } });
    const page2 = await xata.db.users.search('Owner', { page: { size: 1, offset: 1 } });

    expect(page1.length).toBe(1);
    expect(page2.length).toBe(1);

    expect(page1[0].id).not.toBe(page2[0].id);

    expect(page1[0].id).toBe(owners[0].id);
    expect(page2[0].id).toBe(owners[1].id);
  });

  test.skip('global search with page and offset', async () => {
    const { users: owners = [] } = await xata.search.byTable('Owner');
    const { users: page1 = [] } = await xata.search.byTable('Owner', { page: { size: 1 } });
    const { users: page2 = [] } = await xata.search.byTable('Owner', { page: { size: 1, offset: 1 } });

    expect(page1.length).toBe(1);
    expect(page2.length).toBe(1);

    expect(page1[0].id).not.toBe(page2[0].id);

    expect(page1[0].id).toBe(owners[0].id);
    expect(page2[0].id).toBe(owners[1].id);
  });
});

async function waitForSearchIndexing(): Promise<void> {
  const { aggs: teamAggs } = await xata.db.teams.aggregate({ total: { count: '*' } });
  const { aggs: userAggs } = await xata.db.users.aggregate({ total: { count: '*' } });
  if (teams === undefined || teamAggs.total !== teams.length || userAggs.total !== users.length) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return waitForSearchIndexing();
  }
}
