import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  BaseClient,
  contains,
  iContains,
  includesAll,
  includesNone,
  lt,
  Repository,
  XataApiClient,
  XataRecord
} from '../../packages/client/src';
import {
  Paginable,
  PAGINATION_DEFAULT_SIZE,
  PAGINATION_MAX_OFFSET,
  PAGINATION_MAX_SIZE
} from '../../packages/client/src/schema/pagination';
import { UsersRecord, XataClient } from '../../packages/codegen/example/xata';
import { animalUsers, fruitUsers, mockUsers, ownerAnimals, ownerFruits } from '../mock_data';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let api: XataApiClient;
let baseClient: BaseClient;
let workspace: string;
let region: string;
let database: string;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('query');

  xata = result.client;
  api = result.api;
  baseClient = result.baseClient;
  workspace = result.workspace;
  region = result.region;
  database = result.database;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  const { xata_id: ownerAnimalsId } = await xata.db.users.create(ownerAnimals);
  const { xata_id: ownerFruitsId } = await xata.db.users.create(ownerFruits);

  const fruitsTeam = await xata.db.teams.create({
    name: 'Team fruits',
    labels: ['apple', 'banana', 'orange'],
    owner: ownerFruitsId
  });

  const animalsTeam = await xata.db.teams.create({
    name: 'Team animals',
    labels: ['monkey', 'lion', 'eagle', 'dolphin'],
    owner: ownerAnimalsId
  });

  await xata.db.teams.create({
    name: 'Mixed team fruits & animals',
    labels: ['monkey', 'banana', 'apple', 'dolphin']
  });

  await xata.db.users.create([
    ...animalUsers.map((item) => ({ ...item, team: animalsTeam })),
    ...fruitUsers.map((item) => ({ ...item, team: fruitsTeam }))
  ]);
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

describe('integration tests', () => {
  test('equal filter', async () => {
    const teams = await xata.db.teams.filter('name', 'Team fruits').getAll();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Team fruits');

    const serialized = teams.toSerializable();
    expect(serialized).toHaveLength(1);
    expect(serialized[0].name).toBe('Team fruits');

    const string = teams.toString();
    expect(string).toContain('Team fruits');
    const hydrated = JSON.parse(string);
    expect(hydrated).toHaveLength(1);
  });

  test('operator filter', async () => {
    const teams = await xata.db.teams.filter('name', contains('fruits')).getAll({ sort: ['name'] });
    const teams2 = await xata.db.teams.filter('name', iContains('FRUITS')).getAll({ sort: ['name'] });

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team fruits');

    expect(teams2).toHaveLength(2);
    expect(teams2[0].name).toBe('Mixed team fruits & animals');
    expect(teams2[1].name).toBe('Team fruits');
  });

  test('operator filter on multiple column', async () => {
    const teams = await xata.db.teams.create([
      { name: 'Team with banana', labels: ['banana'] },
      { name: 'Team with monkey', labels: ['monkey'] },
      { name: 'Team with other', labels: ['other'] },
      { name: 'Team with banana and monkey', labels: ['banana', 'monkey'] },
      { name: 'Team with banana, monkey and other', labels: ['banana', 'monkey', 'other'] }
    ]);

    const teamsWithBanana = await xata.db.teams.filter('labels', 'banana').getMany();
    const teamsWithBananaOrMonkey = await xata.db.teams.filter('labels', ['banana', 'monkey']).getMany();
    const teamsWithoutBanana = await xata.db.teams.filter('labels', includesNone('banana')).getMany();
    const teamsWithoutBananaNorMonkey = await xata.db.teams
      .filter('labels', includesNone(['banana', 'monkey']))
      .getMany();
    const teamsWithBananaAndMonkey = await xata.db.teams
      .filter('labels', 'banana')
      .filter('labels', 'monkey')
      .getMany();
    const teamsWithOnlyBananaAndMonkey = await xata.db.teams
      .filter('labels', includesAll(['banana', 'monkey']))
      .getMany();

    expect(teamsWithBanana.length).toBeGreaterThan(0);
    expect(teamsWithBanana.every((team) => team.labels?.includes('banana'))).toBe(true);

    expect(teamsWithBananaOrMonkey.length).toBeGreaterThan(0);
    expect(
      teamsWithBananaOrMonkey.every((team) => team.labels?.includes('banana') || team.labels?.includes('monkey'))
    ).toBe(true);

    expect(teamsWithoutBanana.length).toBeGreaterThan(0);
    expect(teamsWithoutBanana.every((team) => !team.labels?.includes('banana'))).toBe(true);

    expect(teamsWithoutBananaNorMonkey.length).toBeGreaterThan(0);
    expect(
      teamsWithoutBananaNorMonkey.every((team) => !team.labels?.includes('banana') && !team.labels?.includes('monkey'))
    ).toBe(true);

    expect(teamsWithBananaAndMonkey.length).toBeGreaterThan(0);
    expect(
      teamsWithBananaAndMonkey.every((team) => team.labels?.includes('banana') && team.labels?.includes('monkey'))
    ).toBe(true);

    expect(teamsWithOnlyBananaAndMonkey.length).toBeGreaterThan(0);
    /** https://github.com/xataio/xata/issues/1073
    expect(
      teamsWithOnlyBananaAndMonkey.every(
        (team) => team.labels?.includes('banana') && team.labels?.includes('monkey') && team.labels?.length === 2
      )
    ).toBe(true);
    **/

    await xata.db.teams.delete(teams);
  });

  test('multiple filter', async () => {
    const teams = await xata.db.teams.filter('name', contains('fruits')).filter('name', contains('Mixed')).getAll();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
  });

  test('sort ascending', async () => {
    const teams = await xata.db.teams.sort('name', 'asc').getAll();

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Team fruits');
  });

  test('sort descending', async () => {
    const teams = await xata.db.teams.sort('name', 'desc').getAll();

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Mixed team fruits & animals');
  });

  test('single filter and sort ascending', async () => {
    const teams = await xata.db.teams.filter('name', contains('fruits')).sort('name', 'asc').getAll();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team fruits');
  });

  test('single filter and sort descending', async () => {
    const teams = await xata.db.teams.filter('name', contains('fruits')).sort('name', 'desc').getAll();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Mixed team fruits & animals');
  });

  test('sort ascending in getAll', async () => {
    const teams = await xata.db.teams.getAll({ sort: 'name' });

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Team fruits');
  });

  test('sort descending in getAll', async () => {
    const teams = await xata.db.teams.getAll({ sort: { column: 'name', direction: 'desc' } });

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Mixed team fruits & animals');
  });

  test('sort random', async () => {
    const teams = await xata.db.teams.sort('*', 'random').getAll();
    const teams2 = await xata.db.teams.getAll({ sort: { column: '*', direction: 'random' } });
    const teams3 = await xata.db.teams.getAll({ sort: { '*': 'random' } });

    expect(teams).toHaveLength(3);
    expect(teams2).toHaveLength(3);
    expect(teams3).toHaveLength(3);
  });

  test('negative filter', async () => {
    const repository = xata.db.teams;
    const teams = await repository.not(repository.filter('name', 'Team fruits')).sort('name', 'asc').getAll();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
  });

  test('filter on nullable property', async () => {
    const ownerAnimals = await xata.db.users.filter('full_name', 'Owner of team animals').getFirst();
    if (!ownerAnimals) throw new Error('Could not find owner of team animals');

    // Regression test on filtering on nullable property
    const team = await xata.db.teams.filter('owner.xata_id', ownerAnimals.xata_id).getFirst();

    expect(team?.owner?.xata_id).toEqual(ownerAnimals.xata_id);
  });

  test('filter on object', async () => {
    const users = await xata.db.users.filter({ zipcode: 100 }).getAll();

    expect(users).toHaveLength(1);
    expect(users[0].full_name).toBe('Owner of team fruits');
  });

  test('filter on object with operator', async () => {
    const users = await xata.db.users.filter({ zipcode: lt(150) }).getAll();

    expect(users).toHaveLength(1);
    expect(users[0].full_name).toBe('Owner of team fruits');
  });

  test('filter on link', async () => {
    const teams = await xata.db.teams.filter({ owner: { full_name: 'Owner of team fruits' } }).getAll();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Team fruits');
  });

  test('filter returns nothing', async () => {
    const teams = await xata.db.teams.filter('name', 'Not even possible').getAll();

    expect(teams).toHaveLength(0);
  });

  test('filter is empty', async () => {
    const teams = await xata.db.teams.filter().getFirst();
    const teams2 = await xata.db.teams.filter(undefined).getFirst();
    const teams3 = await xata.db.teams.filter({}).getFirst();

    expect(teams).toBeDefined();
    expect(teams2).toBeDefined();
    expect(teams3).toBeDefined();
  });

  test('returns single record', async () => {
    const user = await xata.db.users.getFirst();
    expect(user).toBeDefined();
  });

  test('returns many records with offset/size', async () => {
    const records1 = await xata.db.users.getMany({ pagination: { size: 10 } });
    const records2 = await xata.db.users.getMany({ pagination: { size: 10, offset: 10 } });

    expect(records1).not.toEqual(records2);
    expect(records1).toHaveLength(10);
    expect(records2).toHaveLength(10);
  });

  test('returns many records and implements extended array object', async () => {
    const records1 = await xata.db.users.getMany({ pagination: { size: 10 } });
    const hasPage2 = records1.hasNextPage();
    const records2 = await records1.nextPage();

    expect(records1).not.toEqual(records2);
    expect(hasPage2).toBe(true);
    expect(records1).toHaveLength(10);
    expect(records2).toHaveLength(10);
  });

  test('returns many records extended array map converts to a normal array', async () => {
    const records1 = await xata.db.users.filter('team.name', 'Team fruits').getMany();
    const records2 = records1.map((item) => ({ ...item }));

    expect(records1.length).toBeGreaterThan(0);
    expect(records1.length).toBe(records2.length);

    expect(records1.hasNextPage).toBeDefined();
    // @ts-expect-error
    expect(records2.hasNextPage).not.toBeDefined();

    for (const [index, item] of records1.entries()) {
      expect(item).toEqual(records2[index]);
    }
  });

  test('returns many records with cursor', async () => {
    const size = Math.floor(mockUsers.length / 1.5);
    const endPageSize = mockUsers.length - Math.floor(mockUsers.length / 1.5);

    const page1 = await xata.db.users.getPaginated({ pagination: { size } });
    const page2 = await page1.nextPage();
    const page3 = await page2.nextPage();
    const startPage = await page3.startPage();
    const endPage = await page2.endPage();

    expect(page1.records).toHaveLength(size);
    expect(page2.records).toHaveLength(endPageSize);
    expect(page3.records).toHaveLength(0);

    expect(page1.meta.page.more).toBe(true);
    expect(page2.meta.page.more).toBe(false);
    expect(page3.meta.page.more).toBe(false);

    expect(page1.meta.page.size).toBe(size);
    expect(page2.meta.page.size).toBe(size);
    expect(page3.meta.page.size).toBe(size);

    expect(startPage.records.length).toEqual(page1.records.length);

    // In cursor based pagination, the last page is the last N records
    expect(endPage.records).toHaveLength(size);
  });

  test('returns many records with cursor passing a offset/size', async () => {
    const page1 = await xata.db.users.getPaginated({ pagination: { size: 5 } });
    const page2 = await page1.nextPage(10);
    const page3 = await page2.nextPage(10);
    const page2And3 = await page1.nextPage(20);

    expect(page1.records).toHaveLength(5);
    expect(page2.records).toHaveLength(10);
    expect(page3.records).toHaveLength(10);
    expect(page2And3.records).toHaveLength(20);

    expect(page2And3.records.length).toEqual([...page2.records, ...page3.records].length);
  });

  test('fails if sending cursor with sorting', async () => {
    const page1 = await xata.db.users.getPaginated({ pagination: { size: 5 } });
    const { records: records1, meta } = page1;
    const page2 = await page1.nextPage();

    expect(meta.page.more).toBe(true);
    expect(meta.page.cursor).toBeDefined();
    expect(records1).toHaveLength(5);

    const { records: records2, meta: meta2 } = await xata.db.users.getPaginated({
      pagination: { after: meta.page.cursor }
    });

    expect(meta2.page.more).toBe(true);
    expect(meta2.page.cursor).toBeDefined();
    expect(records2.length).toEqual(page2.records.length);

    const { records: records3, meta: meta3 } = await xata.db.users.getPaginated({
      pagination: { after: meta.page.cursor },
      columns: ['full_name']
    });

    expect(meta3.page.more).toBe(true);
    expect(meta3.page.cursor).toBeDefined();
    expect(records3).toHaveLength(5);

    expect(
      xata.db.users.getPaginated({
        // @ts-expect-error
        pagination: { after: meta.page.cursor },
        sort: { column: 'full_name', direction: 'asc' }
      })
    ).rejects.toThrow();
  });

  test('repository implements pagination', async () => {
    const loadUsers = async (repository: Repository<UsersRecord>) => {
      return repository.getPaginated({ pagination: { size: 10 } });
    };

    const users = await loadUsers(xata.db.users);
    expect(users.records).toHaveLength(10);
  });

  test('repository implements paginable', async () => {
    async function foo<T extends XataRecord>(page: Paginable<any>): Promise<T[]> {
      const nextPage = page.hasNextPage() ? await foo(await page.nextPage()) : [];
      return [...page.records, ...nextPage];
    }

    const users = await foo(xata.db.users);
    expect(users).toHaveLength(mockUsers.length);
  });

  test('get all users', async () => {
    const users = await xata.db.users.getAll();
    expect(users).toHaveLength(mockUsers.length);
    expect(users[0].xata_id).toBeDefined();
  });

  test('get first', async () => {
    const user = await xata.db.users.getFirst();
    const definedUser = await xata.db.users.getFirstOrThrow();

    expect(user).toBeDefined();
    expect(definedUser).toBeDefined();
    expect(user?.xata_id).toBe(definedUser.xata_id);
  });

  test('get first not found', async () => {
    const query = xata.db.users.filter('xata_id', 'not-found');

    const user = await query.getFirst();

    expect(user).toBeNull();

    expect(query.getFirstOrThrow()).rejects.toThrow();
  });

  test('query implements iterator', async () => {
    const owners = [];

    for await (const user of xata.db.users.filter('full_name', contains('Owner'))) {
      owners.push(user);
    }

    expect(owners).toHaveLength(2);
    expect(owners.map((user) => user.full_name).sort()).toEqual(['Owner of team animals', 'Owner of team fruits']);
  });

  test('query implements iterator with chunks', async () => {
    const owners = [];

    for await (const chunk of xata.db.users.filter('full_name', contains('Owner')).getIterator({ batchSize: 10 })) {
      owners.push(...chunk);
    }

    expect(owners).toHaveLength(2);
    expect(owners.map((user) => user.full_name).sort()).toEqual(['Owner of team animals', 'Owner of team fruits']);
  });

  test('includes selected columns in query', async () => {
    const user = await xata.db.users.select(['full_name']).getFirst();

    expect(user).toBeDefined();
    expect(user?.xata_id).toBeDefined();
    expect(user?.full_name).toBeDefined();
    //@ts-expect-error
    expect(user?.email).not.toBeDefined();
  });

  test('includes selected columns in getFirst', async () => {
    const user = await xata.db.users.getFirst({
      columns: ['full_name', 'email']
    });

    expect(user).toBeDefined();
    expect(user?.xata_id).toBeDefined();
    expect(user?.full_name).toBeDefined();
    expect(user?.email).toBeDefined();
  });

  test('returns null to links that do not exist', async () => {
    const user = await xata.db.users.create({
      full_name: 'John Doe',
      email: 'john@doe.com',
      street: '123 Main St'
    });

    const records = await xata.db.users.filter('xata_id', user.xata_id).select(['*', 'team.*']).getAll();

    expect(records).toHaveLength(1);
    expect(records[0].xata_id).toBe(user.xata_id);
    expect(records[0].full_name).toBe('John Doe');
    expect(records[0].street).toBe('123 Main St');
    expect(records[0].team).toBeNull();

    await user.delete();
  });

  test('Partial update of a user', async () => {
    const user = await xata.db.users.create({
      full_name: 'John Doe',
      email: 'john@doe.com',
      street: '123 Main St'
    });

    const updatedUserResponse = await xata.db.users.update(user.xata_id, { street: 'New street', zipcode: 11 });

    const updatedUser = await xata.db.users.filter({ xata_id: user.xata_id }).getFirst();
    if (!updatedUser) throw new Error('No user found');

    await user.delete();

    expect(user.xata_id).toBe(updatedUser.xata_id);
    expect(user.street).toBe('123 Main St');
    expect(user.zipcode).toBeNull();

    expect(updatedUserResponse?.street).toBe('New street');
    expect(updatedUserResponse?.zipcode).toBe(11);
    expect(updatedUserResponse?.full_name).toBe(user.full_name);

    expect(updatedUser.street).toBe('New street');
    expect(updatedUser.zipcode).toBe(11);
    expect(updatedUser.full_name).toBe(user.full_name);
  });

  test('Partial update from itself', async () => {
    const user = await xata.db.users.create({
      full_name: 'John Doe 2',
      email: 'john2@doe.com',
      street: '456 Main St'
    });

    const updatedUserResponse = await user.update({ street: 'New street 2', zipcode: 22 });

    const updatedUser = await xata.db.users.filter({ xata_id: user.xata_id }).getFirst();
    if (!updatedUser) throw new Error('No user found');

    await user.delete();

    expect(user.street).not.toBe('New street 2');

    expect(updatedUserResponse?.street).toBe('New street 2');
    expect(updatedUserResponse?.zipcode).toBe(22);
    expect(updatedUserResponse?.full_name).toBe(user.full_name);

    expect(updatedUser.street).toBe('New street 2');
    expect(updatedUser.zipcode).toBe(22);
    expect(updatedUser.full_name).toBe(user.full_name);
  });

  test('Upsert of a user', async () => {
    const user = await xata.db.users.createOrUpdate('my-good-old-john-6', {
      full_name: 'John Doe 6',
      email: 'john6@doe.com'
    });

    const apiUser = await xata.db.users.filter({ xata_id: user.xata_id }).getFirst();
    if (!apiUser) throw new Error('No user found');

    await user.delete();

    expect(user.xata_id).toBe('my-good-old-john-6');
    expect(user.full_name).toBe('John Doe 6');

    expect(user.xata_id).toBe(apiUser.xata_id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);
  });

  test('returns many records with multiple requests', async () => {
    const newUsers = Array.from({ length: PAGINATION_MAX_SIZE + 1 }).map((_, i) => ({ full_name: `user-${i}` }));
    await xata.db.users.create(newUsers);

    const records = await xata.db.users.getMany({ pagination: { size: PAGINATION_MAX_SIZE + 1 } });

    expect(records).toHaveLength(PAGINATION_MAX_SIZE + 1);
    expect(records.hasNextPage).toBeDefined();
  });

  test('Pagination size limit', async () => {
    expect(xata.db.users.getPaginated({ pagination: { size: PAGINATION_MAX_SIZE + 1 } })).rejects.toHaveProperty(
      'message',
      'page size exceeds max limit of 1000'
    );
  });

  test('Pagination offset limit', async () => {
    expect(xata.db.users.getPaginated({ pagination: { offset: PAGINATION_MAX_OFFSET + 1 } })).rejects.toHaveProperty(
      'message',
      'page offset must not exceed 49000'
    );
  });

  test('Pagination default value', async () => {
    const planes = Array.from({ length: PAGINATION_DEFAULT_SIZE + 50 }, (_, index) => ({ name: `Plane ${index}` }));

    const createdPlanes = await xata.db.users.create(planes);
    const queriedPlanes = await xata.db.users.filter({ name: { $startsWith: 'Plane' } }).getPaginated();

    expect(createdPlanes).toHaveLength(PAGINATION_DEFAULT_SIZE + 50);
    expect(queriedPlanes.records).toHaveLength(PAGINATION_DEFAULT_SIZE);
  });

  test('multiple errors in one response', async () => {
    const invalidUsers = [{ full_name: 'a name' }, { full_name: 1 }, { full_name: 2 }] as UsersRecord[];

    expect(xata.db.users.create(invalidUsers)).rejects.toHaveProperty('status', 400);
  });

  test('Link is a record object', async () => {
    const user = await xata.db.users.create({
      full_name: 'Base User'
    });

    const team = await xata.db.teams.create({
      name: 'Base team',
      owner: user
    });

    await user.update({ team });

    const updatedUser = await user.read();
    expect(updatedUser?.team?.xata_id).toEqual(team.xata_id);

    const response = await xata.db.teams.getFirst({ filter: { xata_id: team.xata_id }, columns: ['*', 'owner.*'] });
    const owner = await response?.owner?.read();

    expect(response?.owner?.xata_id).toBeDefined();
    expect(response?.owner?.full_name).toBeDefined();

    expect(owner?.xata_id).toBeDefined();
    expect(owner?.full_name).toBeDefined();

    expect(response?.owner?.xata_id).toBe(owner?.xata_id);
    expect(response?.owner?.full_name).toBe(owner?.full_name);

    expect(response?.owner?.xata_createdat).toBeInstanceOf(Date);
    expect(response?.owner?.xata_updatedat).toBeInstanceOf(Date);
    expect(response?.owner?.xata_version).toBe(1);

    const nestedObject = await xata.db.teams.getFirst({
      filter: { xata_id: team.xata_id },
      columns: ['owner.team', 'owner.full_name']
    });

    const nestedProperty = nestedObject?.owner?.team;
    const nestedName = nestedObject?.owner?.full_name;

    expect(nestedName).toEqual(user.full_name);

    expect(nestedProperty?.name).toEqual(team.name);
    // @ts-expect-error
    expect(nestedProperty?.owner?.full_name).not.toBeDefined();

    const nestedRead = await nestedProperty?.owner?.read();

    expect(nestedRead?.xata_id).toBeDefined();
    expect(nestedRead?.full_name).toEqual(user.full_name);
  });

  test('Update link with linked object', async () => {
    const owner = await xata.db.users.create({ full_name: 'Example User' });
    const owner2 = await xata.db.users.create({ full_name: 'Example User 2' });

    const team = await xata.db.teams.create({ name: 'Example Team', owner });
    const updated = await team.update({ owner: owner2 });

    expect(team.owner?.xata_id).toEqual(owner.xata_id);
    expect(updated?.owner?.xata_id).toEqual(owner2.xata_id);
  });

  test('Update link with linked object (string)', async () => {
    const owner = await xata.db.users.create({ full_name: 'Example User' });
    const owner2 = await xata.db.users.create({ full_name: 'Example User 2' });

    const team = await xata.db.teams.create({ name: 'Example Team', owner: owner.xata_id });
    const updated = await team.update({ owner: owner2.xata_id });

    expect(team.owner?.xata_id).toEqual(owner.xata_id);
    expect(updated?.owner?.xata_id).toEqual(owner2.xata_id);
  });

  test('Filter with null value', async () => {
    const newOwner = await xata.db.users.create({ full_name: 'Example User' });
    const newTeam = await xata.db.teams.create({ name: 'Example Team', owner: newOwner });

    const owner = await xata.db.users.filter({ xata_id: newOwner.xata_id }).getFirst();
    if (!owner) throw new Error('No user found');

    const team = await xata.db.teams.filter({ owner: owner.xata_id }).getFirst();
    expect(team?.xata_id).toEqual(newTeam.xata_id);
  });

  test('Filter with multiple column', async () => {
    const newTeam = await xata.db.teams.create({ name: 'Example Team', labels: ['a', 'b'] });

    const team = await xata.db.teams.filter({ labels: newTeam.labels }).getFirst();
    expect(team?.xata_id).toEqual(newTeam.xata_id);
  });

  test('Partial filters should work', async () => {
    const newTeam = await xata.db.teams.create({ name: 'A random real team', labels: ['a', 'b'] });
    const maybeId = undefined;

    const records = await xata.db.teams.filter({ xata_id: maybeId, name: newTeam.name }).getMany();

    expect(records).toHaveLength(1);
    expect(records[0].xata_id).toEqual(newTeam.xata_id);

    const serialized = records.toSerializable();
    expect(serialized).toHaveLength(1);
    expect(serialized[0].xata_id).toEqual(newTeam.xata_id);

    const string = records.toString();
    expect(string).toContain('A random real team');
    const hydrated = JSON.parse(string);
    expect(hydrated).toHaveLength(1);
  });
});
