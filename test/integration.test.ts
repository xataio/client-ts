import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { BaseClient, contains, lt, Repository, XataApiClient } from '../client/src';
import {
  Paginable,
  PAGINATION_DEFAULT_SIZE,
  PAGINATION_MAX_OFFSET,
  PAGINATION_MAX_SIZE
} from '../client/src/schema/pagination';
import { User, UserRecord, XataClient } from '../codegen/example/xata';
import { mockUsers, teamColumns, userColumns } from './mock_data';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.envrc') });

let client: XataClient;
let schemaLessclient: BaseClient;
let databaseName: string;

const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const api = new XataApiClient({
  apiKey: process.env.XATA_API_KEY || '',
  fetch
});

// Integration tests take longer than unit tests, increasing the timeout
jest.setTimeout(500000);

beforeAll(async () => {
  const id = Math.round(Math.random() * 100000);

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-${id}`);
  databaseName = database.databaseName;

  client = new XataClient({
    databaseURL: `https://${workspace}.xata.sh/db/${database.databaseName}`,
    branch: 'main',
    apiKey: process.env.XATA_API_KEY || '',
    fetch
  });

  schemaLessclient = new BaseClient({
    databaseURL: `https://${workspace}.xata.sh/db/${database.databaseName}`,
    branch: 'main',
    apiKey: process.env.XATA_API_KEY || '',
    fetch
  });

  await api.tables.createTable(workspace, databaseName, 'main', 'teams');
  await api.tables.createTable(workspace, databaseName, 'main', 'users');
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'teams', { columns: teamColumns });
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'users', { columns: userColumns });

  const teams = await client.db.teams.getMany();
  for (const team of teams) {
    await team.delete();
  }

  const users = await client.db.users.getMany();
  for (const user of users) {
    await user.delete();
  }

  await client.db.users.createMany(mockUsers);

  const ownerAnimals = await client.db.users.filter('full_name', 'Owner of team animals').getOne();
  const ownerFruits = await client.db.users.filter('full_name', 'Owner of team fruits').getOne();
  if (!ownerAnimals || !ownerFruits) {
    throw new Error('Could not find owner of team animals or owner of team fruits');
  }

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

afterAll(async () => {
  await api.databases.deleteDatabase(workspace, databaseName);
});

describe('integration tests', () => {
  test('equal filter', async () => {
    const teams = await client.db.teams.filter('name', 'Team fruits').getMany();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Team fruits');
  });

  test('operator filter', async () => {
    const teams = await client.db.teams.filter('name', contains('fruits')).getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Mixed team fruits & animals');
  });

  test.skip('operator filter on multiple column', async () => {
    const teams = await client.db.teams.filter('labels', ['banana']).getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team fruits');
  });

  test('multiple filter', async () => {
    const teams = await client.db.teams.filter('name', contains('fruits')).filter('name', contains('Mixed')).getMany();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
  });

  test('sort ascending', async () => {
    const teams = await client.db.teams.sort('name', 'asc').getMany();

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Team fruits');
  });

  test('sort descending', async () => {
    const teams = await client.db.teams.sort('name', 'desc').getMany();

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Mixed team fruits & animals');
  });

  test('single filter and sort ascending', async () => {
    const teams = await client.db.teams.filter('name', contains('fruits')).sort('name', 'asc').getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team fruits');
  });

  test('single filter and sort descending', async () => {
    const teams = await client.db.teams.filter('name', contains('fruits')).sort('name', 'desc').getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Mixed team fruits & animals');
  });

  test('sort ascending in getMany', async () => {
    const teams = await client.db.teams.getMany({ sort: 'name' });

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Team fruits');
  });

  test('sort descending in getMany', async () => {
    const teams = await client.db.teams.getMany({ sort: { column: 'name', direction: 'desc' } });

    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe('Team fruits');
    expect(teams[1].name).toBe('Team animals');
    expect(teams[2].name).toBe('Mixed team fruits & animals');
  });

  test('negative filter', async () => {
    const repository = client.db.teams;
    const teams = await repository.not(repository.filter('name', 'Team fruits')).sort('name', 'asc').getMany();

    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Mixed team fruits & animals');
    expect(teams[1].name).toBe('Team animals');
  });

  test('filter on object', async () => {
    const users = await client.db.users
      .filter({
        address: {
          zipcode: 100
        }
      })
      .getMany();

    expect(users).toHaveLength(1);
    expect(users[0].full_name).toBe('Owner of team fruits');
  });

  test('filter on object with operator', async () => {
    const users = await client.db.users
      .filter({
        address: {
          zipcode: lt(150)
        }
      })
      .getMany();

    expect(users).toHaveLength(1);
    expect(users[0].full_name).toBe('Owner of team fruits');
  });

  test('filter on link', async () => {
    const teams = await client.db.teams
      .filter({
        owner: {
          full_name: 'Owner of team fruits'
        }
      })
      .getMany();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Team fruits');
  });

  test('returns single record', async () => {
    const user = await client.db.users.getOne();
    expect(user).toBeDefined();
  });

  test('returns many records with offset/size', async () => {
    const page1 = await client.db.users.getMany({ page: { size: 10 } });
    const page2 = await client.db.users.getMany({ page: { size: 10, offset: 10 } });

    expect(page1).not.toEqual(page2);
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
  });

  test('returns many records with cursor', async () => {
    const size = Math.floor(mockUsers.length / 1.5);
    const lastPageSize = mockUsers.length - Math.floor(mockUsers.length / 1.5);

    const page1 = await client.db.users.getPaginated({ page: { size } });
    const page2 = await page1.nextPage();
    const page3 = await page2.nextPage();
    const firstPage = await page3.firstPage();
    const lastPage = await page2.lastPage();

    expect(page1.records).toHaveLength(size);
    expect(page2.records).toHaveLength(lastPageSize);
    expect(page3.records).toHaveLength(0);

    expect(page1.meta.page.more).toBe(true);
    expect(page2.meta.page.more).toBe(false);
    expect(page3.meta.page.more).toBe(false);

    expect(firstPage.records).toEqual(page1.records);

    // In cursor based pagination, the last page is the last N records
    expect(lastPage.records).toHaveLength(size);
  });

  test('returns many records with cursor passing a offset/size', async () => {
    const page1 = await client.db.users.getPaginated({ page: { size: 5 } });
    const page2 = await page1.nextPage(10);
    const page3 = await page2.nextPage(10);
    const page2And3 = await page1.nextPage(20);

    expect(page1.records).toHaveLength(5);
    expect(page2.records).toHaveLength(10);
    expect(page3.records).toHaveLength(10);
    expect(page2And3.records).toHaveLength(20);

    expect(page2And3.records).toEqual([...page2.records, ...page3.records]);
  });

  test('repository implements pagination', async () => {
    const loadUsers = async (repository: Repository<UserRecord>) => {
      return repository.getPaginated({ page: { size: 10 } });
    };

    const users = await loadUsers(client.db.users);
    expect(users.records).toHaveLength(10);
  });

  test('repository implements paginable', async () => {
    async function foo(page: Paginable<UserRecord>): Promise<User[]> {
      const nextPage = page.hasNextPage() ? await foo(await page.nextPage()) : [];
      return [...page.records, ...nextPage];
    }

    const users = await foo(client.db.users);
    expect(users).toHaveLength(mockUsers.length);
  });

  test('get all users', async () => {
    const users = await client.db.users.getAll();
    expect(users).toHaveLength(mockUsers.length);
    expect(users[0].id).toBeDefined();
  });

  test('create single team', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    expect(team.id).toBeDefined();
    expect(team.name).toBe('Team ships');
  });

  test('create multiple teams', async () => {
    const teams = await client.db.teams.createMany([{ name: 'Team cars' }, { name: 'Team planes' }]);

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBeDefined();
    expect(teams[0].name).toBe('Team cars');
    expect(teams[1].id).toBeDefined();
    expect(teams[1].name).toBe('Team planes');
  });

  test('query implements iterator', async () => {
    const owners = [];

    for await (const user of client.db.users.filter('full_name', contains('Owner'))) {
      owners.push(user);
    }

    expect(owners).toHaveLength(2);
    expect(owners.map((user) => user.full_name).sort()).toEqual(['Owner of team animals', 'Owner of team fruits']);
  });

  test('query implements iterator with chunks', async () => {
    const owners = [];

    for await (const chunk of client.db.users.filter('full_name', contains('Owner')).getIterator(10)) {
      owners.push(...chunk);
    }

    expect(owners).toHaveLength(2);
    expect(owners.map((user) => user.full_name).sort()).toEqual(['Owner of team animals', 'Owner of team fruits']);
  });

  test('includes selected columns in query', async () => {
    const user = await client.db.users.select(['full_name']).getOne();

    expect(user).toBeDefined();
    expect(user?.id).toBeDefined();
    expect(user?.full_name).toBeDefined();
    //@ts-expect-error
    expect(user?.email).toBeUndefined();
  });

  test('includes selected columns in getOne', async () => {
    const user = await client.db.users.getOne({
      columns: ['full_name', 'email']
    });

    expect(user).toBeDefined();
    expect(user?.id).toBeDefined();
    expect(user?.full_name).toBeDefined();
    expect(user?.email).toBeDefined();
    //@ts-expect-error
    expect(user?.address).toBeUndefined();
  });

  test('Partial update of a user', async () => {
    const user = await client.db.users.create({
      full_name: 'John Doe',
      email: 'john@doe.com',
      address: {
        street: '123 Main St'
      }
    });

    const updatedUserResponse = await client.db.users.update(user.id, {
      address: { street: 'New street', zipcode: 11 }
    });

    const updatedUser = await client.db.users.filter({ id: user.id }).getOne();
    if (!updatedUser) throw new Error('No user found');

    await user.delete();

    expect(user.id).toBe(updatedUser.id);
    expect(user.address?.street).toBe('123 Main St');
    expect(user.address?.zipcode).toBeUndefined();

    expect(updatedUserResponse.address?.street).toBe('New street');
    expect(updatedUserResponse.address?.zipcode).toBe(11);
    expect(updatedUserResponse.full_name).toBe(user.full_name);

    expect(updatedUser.address?.street).toBe('New street');
    expect(updatedUser.address?.zipcode).toBe(11);
    expect(updatedUser.full_name).toBe(user.full_name);
  });

  test('Partial update from itself', async () => {
    const user = await client.db.users.create({
      full_name: 'John Doe 2',
      email: 'john2@doe.com',
      address: {
        street: '456 Main St'
      }
    });

    const updatedUserResponse = await user.update({
      address: { street: 'New street 2', zipcode: 22 }
    });

    const updatedUser = await client.db.users.filter({ id: user.id }).getOne();
    if (!updatedUser) throw new Error('No user found');

    await user.delete();

    expect(user.address?.street).not.toBe('New street 2');

    expect(updatedUserResponse.address?.street).toBe('New street 2');
    expect(updatedUserResponse.address?.zipcode).toBe(22);
    expect(updatedUserResponse.full_name).toBe(user.full_name);

    expect(updatedUser.address?.street).toBe('New street 2');
    expect(updatedUser.address?.zipcode).toBe(22);
    expect(updatedUser.full_name).toBe(user.full_name);
  });

  test('Insert user without id', async () => {
    expect(
      client.db.users.insert('', {
        full_name: 'John Doe 3',
        email: 'john3@doe.com'
      })
    ).rejects.toMatchInlineSnapshot(`
      Object {
        "message": "Not Found",
        "status": 404,
      }
    `);

    // @ts-expect-error
    const user = await client.db.users.insert(undefined, {
      full_name: 'John Doe 3',
      email: 'john3@doe.com'
    });

    const apiUser = await client.db.users.filter({ id: user.id }).getOne();
    if (!apiUser) throw new Error('No user found');

    expect(user.id).toBeDefined();
    expect(user.full_name).toBe('John Doe 3');

    expect(user.id).toBe(apiUser.id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);
  });

  test('Insert a user with id', async () => {
    const user = await client.db.users.insert('a-unique-record-john-4', {
      full_name: 'John Doe 4',
      email: 'john4@doe.com'
    });

    const apiUser = await client.db.users.filter({ id: user.id }).getOne();
    if (!apiUser) throw new Error('No user found');

    expect(user.id).toBe('a-unique-record-john-4');
    expect(user.full_name).toBe('John Doe 4');

    expect(user.id).toBe(apiUser.id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);

    /** https://github.com/xataio/xata/issues/660
    expect(
      client.db.users.insert('a-unique-record-john-4', {
        full_name: 'John Doe 5',
        email: 'john5@doe.com'
      })
    ).rejects.toMatchInlineSnapshot();**/
  });

  test('Upsert of a user', async () => {
    const user = await client.db.users.updateOrInsert('my-good-old-john-6', {
      full_name: 'John Doe 6',
      email: 'john6@doe.com'
    });

    const apiUser = await client.db.users.filter({ id: user.id }).getOne();
    if (!apiUser) throw new Error('No user found');

    await user.delete();

    expect(user.id).toBe('my-good-old-john-6');
    expect(user.full_name).toBe('John Doe 6');

    expect(user.id).toBe(apiUser.id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);
  });

  test('Pagination size limit', async () => {
    expect(client.db.users.getPaginated({ page: { size: PAGINATION_MAX_SIZE + 1 } })).rejects.toMatchInlineSnapshot(`
      Object {
        "message": "page size exceeds max limit of 200",
        "status": 400,
      }
    `);
  });

  test('Pagination offset limit', async () => {
    expect(client.db.users.getPaginated({ page: { offset: PAGINATION_MAX_OFFSET + 1 } })).rejects
      .toMatchInlineSnapshot(`
      Object {
        "message": "page offset must not exceed 800",
        "status": 400,
      }
    `);
  });

  test('Pagination default value', async () => {
    await api.tables.createTable(workspace, databaseName, 'main', 'planes');
    await api.tables.setTableSchema(workspace, databaseName, 'main', 'planes', {
      columns: [{ name: 'name', type: 'string' }]
    });

    const planes = Array(250).map((_, index) => ({ name: `Plane ${index}` }));

    const createdPlanes = await schemaLessclient.db.planes.createMany(planes);
    const queriedPlanes = await schemaLessclient.db.planes.getPaginated();

    expect(createdPlanes).toHaveLength(250);
    expect(queriedPlanes.records).toHaveLength(PAGINATION_DEFAULT_SIZE);
  });
});
