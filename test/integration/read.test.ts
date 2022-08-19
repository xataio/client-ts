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

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-read-${id}`);
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

describe('record read', () => {
  test('read single team with id', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    const copy = await client.db.teams.read(team.id);

    expect(copy).toBeDefined();
    expect(copy?.id).toBe(team.id);
  });

  test('read multiple teams ', async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await client.db.teams.read(teams);

    expect(copies).toHaveLength(2);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);
  });

  test('read multiple teams with id list', async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await client.db.teams.read(teams.map((team) => team.id));

    expect(copies).toHaveLength(2);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);
  });

  test("read single and return null if team doesn't exist", async () => {
    const copy = await client.db.teams.read('does-not-exist');
    expect(copy).toBeNull();
  });

  test("read multiple teams with id list and ignores a team if doesn't exist", async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await client.db.teams.read(teams.map((team) => team.id).concat(['does-not-exist']));

    expect(copies).toHaveLength(3);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);
    expect(copies[2]).toBeNull();
  });

  test('read multiple with empty array', async () => {
    const copies = await client.db.teams.read([]);
    expect(copies).toHaveLength(0);
  });

  test('read multiple with falsy values', async () => {
    const items = [null, undefined, false, 0, ''];

    // @ts-ignore
    const result = await client.db.teams.read(items);

    expect(result).toHaveLength(items.length);
    expect(result).toEqual(items.map(() => null));
  });

  test('records are readonly', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    expect(Object.getOwnPropertyDescriptor(team, 'name')?.writable).toBe(false);

    try {
      // @ts-ignore
      team.name = 'New name';

      throw new Error('Unknown error');
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
    }
  });
});
