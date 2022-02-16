import { contains, includes } from '../client/src';
import { XataClient } from '../codegen/example/xata';

const client = new XataClient({
  databaseURL: process.env.XATA_DATABASE_URL,
  apiKey: process.env.XATA_API_KEY
});

beforeAll(async () => {
  const teams = await client.db.teams.select().getMany();
  for (const team of teams) {
    await team.delete();
  }

  const users = await client.db.users.select().getMany();
  for (const user of users) {
    await user.delete();
  }

  const ownerFruits = await client.db.users.create({
    full_name: 'Owner of team fruits',
    email: 'owner.fruits@example.com'
  });

  const ownerAnimals = await client.db.users.create({
    full_name: 'Owner of team animals',
    email: 'owner.animals@example.com'
  });

  await client.db.teams.create({
    name: 'Team fruits',
    labels: ['apple', 'banana', 'orange'],
    owner: ownerFruits
  });

  await client.db.teams.create({
    name: 'Team animals',
    labels: ['monkey', 'lion', 'eagle', 'dolphin'],
    owner: ownerAnimals
  });

  await client.db.teams.create({
    name: 'Mixed team fruits & animals',
    labels: ['monkey', 'banana', 'apple', 'dolphin']
  });
});

describe('integration tests', () => {
  test('equal filter', async () => {
    const teams = await client.db.teams.select().filter('name', 'Team fruits').getMany();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Team fruits');
  });

  test('operator filter', async () => {
    const teams = await client.db.teams.select().filter('name', contains('fruits')).getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Mixed team fruits & animals');
  });

  test.skip('operator filter on multiple column', async () => {
    const teams = await client.db.teams
      .select()
      .filter('labels', contains(['banana']))
      .getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team fruits');
  });

  test('multiple filter', async () => {
    const teams = await client.db.teams
      .select()
      .filter('name', contains('fruits'))
      .filter('name', contains('Mixed'))
      .getMany();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
  });

  test('sort ascending', async () => {
    const teams = await client.db.teams.select().sort('name', 'asc').getMany();

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Team fruits');
  });

  test('sort descending', async () => {
    const teams = await client.db.teams.select().sort('name', 'desc').getMany();

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Mixed team fruits & animals');
  });

  test('single filter and sort ascending', async () => {
    const teams = await client.db.teams.select().filter('name', contains('fruits')).sort('name', 'asc').getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team fruits');
  });

  test('single filter and sort descending', async () => {
    const teams = await client.db.teams.select().filter('name', contains('fruits')).sort('name', 'desc').getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Mixed team fruits & animals');
  });

  test('negative filter', async () => {
    const q = client.db.teams.select();
    const teams = await q.not(q.filter('name', 'Team fruits')).getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
  });
});
