import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { XataApiClient } from '../../packages/client/src';
import { XataClient } from '../../packages/codegen/example/xata';
import { teamColumns, userColumns } from '../mock_data';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.envrc') });

let client: XataClient;
let databaseName: string;

const apiKey = process.env.XATA_API_KEY ?? '';
const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const api = new XataApiClient({ apiKey, fetch });

beforeAll(async () => {
  const id = Math.round(Math.random() * 100000);

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-createOrUpdate-${id}`);
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

describe('record create or update', () => {
  test('create or update single team with id', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await client.db.teams.createOrUpdate(team.id, { name: 'Team boats' });

    expect(updatedTeam.id).toBe(team.id);
    expect(updatedTeam.read).toBeDefined();

    const apiTeam = await client.db.teams.filter({ id: team.id }).getFirst();

    expect(updatedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test('create or update team with inline id', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await client.db.teams.createOrUpdate({ id: team.id, name: 'Team boats' });

    expect(updatedTeam.id).toBe(team.id);
    expect(updatedTeam.read).toBeDefined();

    const apiTeam = await client.db.teams.filter({ id: team.id }).getFirst();

    expect(updatedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test('create or update multiple teams', async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const updatedTeams = await client.db.teams.createOrUpdate(
      teams.map((team) => ({ id: team.id, name: 'Team boats' }))
    );

    expect(updatedTeams).toHaveLength(2);
    expect(updatedTeams[0].read).toBeDefined();

    const apiTeams = await client.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(2);

    expect(apiTeams[0].name).toBe('Team boats');
    expect(apiTeams[1].name).toBe('Team boats');
  });

  test("create or update many with empty array doesn't create or update anything", async () => {
    const updatedTeams = await client.db.teams.createOrUpdate([]);
    expect(updatedTeams).toHaveLength(0);
  });
});
