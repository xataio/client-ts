import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { XataApiClient } from '../../packages/client/src';
import { XataClient } from '../../packages/codegen/example/xata';
import { teamColumns, userColumns } from '../mock_data';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

let client: XataClient;
let databaseName: string;

const apiKey = process.env.XATA_API_KEY ?? '';
const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const api = new XataApiClient({ apiKey, fetch });

beforeAll(async () => {
  const id = Math.round(Math.random() * 100000);

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-create-${id}`);
  databaseName = database.databaseName;

  client = new XataClient({
    databaseURL: `https://${workspace}.xata.sh/db/${database.databaseName}`,
    branch: 'main',
    apiKey: process.env.XATA_API_KEY || '',
    fetch
  });

  await api.tables.createTable(workspace, databaseName, 'main', 'teams');
  await api.tables.createTable(workspace, databaseName, 'main', 'users');
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'teams', { columns: teamColumns });
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'users', { columns: userColumns });
});

afterAll(async () => {
  await api.databases.deleteDatabase(workspace, databaseName);
});

describe('record creation', () => {
  test('create single team without id', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    expect(team.id).toBeDefined();
    expect(team.name).toBe('Team ships');
  });

  test('create multiple teams without ids', async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBeDefined();
    expect(teams[0].name).toBe('Team cars');
    expect(teams[0].read).toBeDefined();
    expect(teams[1].id).toBeDefined();
    expect(teams[1].name).toBe('Team planes');
    expect(teams[1].read).toBeDefined();
  });

  test('create user with id', async () => {
    const user = await client.db.users.create('a-unique-record-john-4', {
      full_name: 'John Doe 4',
      email: 'john4@doe.com'
    });

    const apiUser = await client.db.users.filter({ id: user.id }).getFirst();
    if (!apiUser) throw new Error('No user found');

    expect(user.id).toBe('a-unique-record-john-4');
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe('John Doe 4');

    expect(user.id).toBe(apiUser.id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);

    expect(
      client.db.users.create('a-unique-record-john-4', {
        full_name: 'John Doe 5',
        email: 'john5@doe.com'
      })
    ).rejects.toHaveProperty('status', 422);
  });

  test('create user with inlined id', async () => {
    const user = await client.db.users.create({
      id: 'a-unique-record-john-5',
      full_name: 'John Doe 5',
      email: 'john5@doe.com'
    });

    const apiUser = await client.db.users.filter({ id: user.id }).getFirst();
    if (!apiUser) throw new Error('No user found');

    expect(user.id).toBe('a-unique-record-john-5');
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe('John Doe 5');

    expect(user.id).toBe(apiUser.id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);
  });

  test('create user with empty id is not allowed', async () => {
    expect(
      client.db.users.create('', {
        full_name: 'John Doe 3',
        email: 'john3@doe.com'
      })
    ).rejects.toMatchInlineSnapshot(`[Error: The id can't be empty]`);
  });

  test('create user with empty inline id is not allowed', async () => {
    expect(
      client.db.users.create({
        id: '',
        full_name: 'John Doe 3',
        email: 'john3@doe.com'
      })
    ).rejects.toMatchInlineSnapshot(`[Error: The id can't be empty]`);
  });

  test('create user with falsy id is not allowed', async () => {
    expect(
      //@ts-expect-error
      client.db.users.create(null, {
        full_name: 'John Doe 3',
        email: 'john3@doe.com'
      })
    ).rejects.toMatchInlineSnapshot(`[Error: Invalid arguments for create method]`);
  });

  test("create multiple with empty array doesn't create anything", async () => {
    const teams = await client.db.teams.create([]);
    expect(teams).toHaveLength(0);
  });

  test('create multiple some with id and others without id', async () => {
    const teams = await client.db.teams.create([{ id: 'team_cars', name: 'Team cars' }, { name: 'Team planes' }]);

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBe('team_cars');
    expect(teams[0].name).toBe('Team cars');
    expect(teams[0].read).toBeDefined();
    expect(teams[1].id).toBeDefined();
    expect(teams[1].name).toBe('Team planes');
    expect(teams[1].read).toBeDefined();
  });

  test('create multiple with returning columns', async () => {
    const teams = await client.db.teams.create(
      [{ name: 'Team cars' }, { name: 'Team planes', labels: ['foo'] }],
      ['id']
    );

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBeDefined();
    // @ts-expect-error
    expect(teams[0].name).toBeUndefined();
    expect(teams[0].read).toBeDefined();
    expect(teams[1].id).toBeDefined();
    // @ts-expect-error
    expect(teams[1].name).toBeUndefined();
    expect(teams[1].read).toBeDefined();

    const team1 = await teams[0].read();
    expect(team1?.id).toBe(teams[0].id);
    expect(team1?.name).toBe('Team cars');

    const team2 = await teams[1].read(['labels']);
    expect(team2?.id).toBe(teams[1].id);
    // @ts-expect-error
    expect(team2?.name).toBeUndefined();
    expect(team2?.labels).toEqual(['foo']);
  });

  test('create single with returning columns', async () => {
    const team = await client.db.teams.create({ name: 'Team cars' }, ['id']);

    expect(team).toBeDefined();
    expect(team.id).toBeDefined();
    // @ts-expect-error
    expect(team.name).toBeUndefined();
    expect(team.read).toBeDefined();

    const team1 = await team.read();
    expect(team1?.id).toBe(team.id);
    expect(team1?.name).toBe('Team cars');
  });
});
