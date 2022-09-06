import { afterAll, afterEach, beforeAll, beforeEach, expect, describe } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';
import { test } from '../utils/tracing';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('dates');

  xata = result.client;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);
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
