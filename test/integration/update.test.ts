import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment } from '../utils/setup';

let xata: XataClient;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const result = await setUpTestEnvironment('update');

  xata = result.client;
  cleanup = result.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('record update', () => {
  test('update single team', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await xata.db.teams.update(team.id, { name: 'Team boats' });

    expect(updatedTeam?.id).toBe(team.id);

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();
    if (!apiTeam) throw new Error('No team found');

    expect(updatedTeam?.name).toBe('Team boats');
    expect(apiTeam.name).toBe('Team boats');
  });

  test('update multiple teams', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const updatedTeams = await xata.db.teams.update(teams.map((team) => ({ ...team, name: 'Team boats' })));

    expect(updatedTeams).toHaveLength(2);

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(2);
    expect(apiTeams[0].name).toBe('Team boats');
    expect(apiTeams[1].name).toBe('Team boats');
  });

  test('update team with inline id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await xata.db.teams.update({ id: team.id, name: 'Team boats' });

    expect(updatedTeam?.id).toBe(team.id);

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(updatedTeam?.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test("update many with empty array doesn't update anything", async () => {
    const updatedTeams = await xata.db.teams.update([]);
    expect(updatedTeams).toHaveLength(0);
  });

  test('update invalid items returns null', async () => {
    const valid = await xata.db.teams.create({ name: 'Team ships' });

    const team1 = await xata.db.teams.update('invalid', { name: 'Team boats' });
    const team2 = await xata.db.teams.update({ id: 'invalid', name: 'Team boats' });
    const team3 = await xata.db.teams.update([
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
