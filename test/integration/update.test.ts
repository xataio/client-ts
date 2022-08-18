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

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-update-${id}`);
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

describe('record update', () => {
  test('update single team', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await client.db.teams.update(team.id, { name: 'Team boats' });

    expect(updatedTeam?.id).toBe(team.id);

    const apiTeam = await client.db.teams.filter({ id: team.id }).getFirst();
    if (!apiTeam) throw new Error('No team found');

    expect(updatedTeam?.name).toBe('Team boats');
    expect(apiTeam.name).toBe('Team boats');
  });

  test('update multiple teams', async () => {
    const teams = await client.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const updatedTeams = await client.db.teams.update(teams.map((team) => ({ ...team, name: 'Team boats' })));

    expect(updatedTeams).toHaveLength(2);

    const apiTeams = await client.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(2);
    expect(apiTeams[0].name).toBe('Team boats');
    expect(apiTeams[1].name).toBe('Team boats');
  });

  test('update team with inline id', async () => {
    const team = await client.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await client.db.teams.update({ id: team.id, name: 'Team boats' });

    expect(updatedTeam?.id).toBe(team.id);

    const apiTeam = await client.db.teams.filter({ id: team.id }).getFirst();

    expect(updatedTeam?.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test("update many with empty array doesn't update anything", async () => {
    const updatedTeams = await client.db.teams.update([]);
    expect(updatedTeams).toHaveLength(0);
  });

  test('update invalid items returns null', async () => {
    const valid = await client.db.teams.create({ name: 'Team ships' });

    const team1 = await client.db.teams.update('invalid', { name: 'Team boats' });
    const team2 = await client.db.teams.update({ id: 'invalid', name: 'Team boats' });
    const team3 = await client.db.teams.update([
      { id: 'invalid', name: 'Team boats' },
      { id: valid.id, name: 'Team boats' }
    ]);

    expect(team1).toBeNull();
    expect(team2).toBeNull();
    expect(team3[0]).toBeNull();
    expect(team3[1]).toBeDefined();
    expect(team3[1]?.id).toBe(valid.id);
    expect(team3[1]?.name).toBe('Team boats');
  });
});
