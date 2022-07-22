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

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-delete-${id}`);
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

describe('record deletion', () => {
  test('delete single team with id', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    await client.db.teams.delete(team.id);

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await client.db.teams.filter({ id: team.id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test('delete multiple teams with id list', async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    await client.db.teams.delete(teams.map((team) => team.id));

    const apiTeams = await client.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(0);
  });

  test('delete single team with id in object', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    await client.db.teams.delete(team);

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await client.db.teams.filter({ id: team.id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test('delete multiple teams with id in object', async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    await client.db.teams.delete(teams);

    const apiTeams = await client.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(0);
  });

  test('delete team with own operation', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    await team.delete();

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await client.db.teams.filter({ id: team.id }).getFirst();

    expect(apiTeam).toBeNull();
  });
});
