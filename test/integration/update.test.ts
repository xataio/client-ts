import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('update');

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
      { id: valid.id, name: 'Team boats 2' }
    ]);

    expect(team1).toBeNull();
    expect(team2).toBeNull();
    expect(team3[0]).toBeNull();
    expect(team3[1]).toBeDefined();
    expect(team3[1]?.id).toBe(valid.id);
    expect(team3[1]?.name).toBe('Team boats 2');
  });

  test('update item with if version', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });
    const { version: versionA } = team.getMetadata();

    const updatedTeam = await xata.db.teams.update(team.id, { name: 'Team boats' }, { ifVersion: versionA });
    const { version: versionB } = updatedTeam?.getMetadata() || {};

    expect(updatedTeam?.id).toBe(team.id);
    expect(versionB).toBe(versionA + 1);

    const updatedTeam2 = await xata.db.teams.update(team.id, { name: 'Team planes' }, { ifVersion: versionA });
    const { version: versionC } = updatedTeam2?.getMetadata() || {};

    expect(updatedTeam2).toBeNull();
    expect(versionC).toBe(undefined);

    const updatedTeam3 = await team.update({ name: 'Team cars' }, { ifVersion: versionA });
    const { version: versionD } = updatedTeam3?.getMetadata() || {};

    expect(updatedTeam3).toBeNull();
    expect(versionD).toBe(undefined);

    expect(xata.db.teams.updateOrThrow(team.id, { name: 'Team cars' }, { ifVersion: versionA })).rejects.toThrow();
  });

  test('update item with id column', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const update1 = await xata.db.teams.update(team.id, { name: 'Team boats' });

    expect(update1?.id).toBe(team.id);
    expect(update1?.name).toBe('Team boats');

    const update2 = await xata.db.teams.update({ id: team.id, name: 'Team planes' });

    expect(update2?.id).toBe(team.id);
    expect(update2?.name).toBe('Team planes');

    const update3 = await xata.db.teams.update([{ id: team.id, name: 'Team cars' }]);

    expect(update3[0]?.id).toBe(team.id);
    expect(update3[0]?.name).toBe('Team cars');

    const update4 = await update1?.update({ name: 'Team trains' });

    expect(update4?.id).toBe(team.id);
    expect(update4?.name).toBe('Team trains');

    const update5 = await update1?.update({ id: update1?.id, name: 'Team boats' });

    expect(update5?.id).toBe(team.id);
    expect(update5?.name).toBe('Team boats');

    const copy = await update2?.read();

    expect(copy?.id).toBe(team.id);
    expect(copy?.name).toBe('Team boats');
  });
});
