import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { mockUsers } from '../mock_data';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('search');

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
});

async function waitForSearchIndexing(): Promise<void> {
  const { users = [], teams = [] } = await xata.search.byTable('fruits');
  if (users.length === 0 || teams.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return waitForSearchIndexing();
  }
}
