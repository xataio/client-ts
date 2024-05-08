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

    const updatedTeam = await xata.db.teams.update(team.xata_id, { name: 'Team boats' });

    expect(updatedTeam?.xata_id).toBe(team.xata_id);

    const apiTeam = await xata.db.teams.filter({ xata_id: team.xata_id }).getFirst();
    if (!apiTeam) throw new Error('No team found');

    expect(updatedTeam?.name).toBe('Team boats');
    expect(apiTeam.name).toBe('Team boats');
  });

  test.skip('update multiple teams', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const updatedTeams = await xata.db.teams.update(teams.map((team) => ({ ...team, name: 'Team boats' })));

    expect(updatedTeams).toHaveLength(2);

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ xata_id: t.xata_id })) }).getAll();

    expect(apiTeams).toHaveLength(2);
    expect(apiTeams[0].name).toBe('Team boats');
    expect(apiTeams[1].name).toBe('Team boats');
  });

  test('update team with inline id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await xata.db.teams.update({ xata_id: team.xata_id, name: 'Team boats' });

    expect(updatedTeam?.xata_id).toBe(team.xata_id);

    const apiTeam = await xata.db.teams.filter({ xata_id: team.xata_id }).getFirst();

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
    const team2 = await xata.db.teams.update({ xata_id: 'invalid', name: 'Team boats' });
    const team3 = await xata.db.teams.update([
      { xata_id: 'invalid', name: 'Team boats' },
      { xata_id: valid.xata_id, name: 'Team boats 2' }
    ]);

    expect(team1).toBeNull();
    expect(team2).toBeNull();
    expect(team3[0]).toBeNull();
    expect(team3[1]).toBeDefined();
    expect(team3[1]?.xata_id).toBe(valid.xata_id);
    expect(team3[1]?.name).toBe('Team boats 2');
  });

  test.skip('update item with if version', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });
    const baseVersion = team.xata_version;

    const updatedTeam = await xata.db.teams.update(team.xata_id, { name: 'Team boats' }, { ifVersion: baseVersion });

    expect(updatedTeam?.xata_id).toBe(team.xata_id);
    expect(updatedTeam?.xata_version).toBe(baseVersion + 1);

    const updatedTeam2 = await xata.db.teams.update(team.xata_id, { name: 'Team planes' }, { ifVersion: baseVersion });

    expect(updatedTeam2).toBeNull();
    expect(updatedTeam2?.xata_version).toBe(undefined);

    const updatedTeam3 = await team.update({ name: 'Team cars' }, { ifVersion: baseVersion });

    expect(updatedTeam3).toBeNull();
    expect(updatedTeam3?.xata_version).toBe(undefined);

    expect(
      xata.db.teams.updateOrThrow(team.xata_id, { name: 'Team cars' }, { ifVersion: baseVersion })
    ).rejects.toThrow();
  });

  // TODO figure out why record read isn't defined
  test.skip('update item with id column', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const update1 = await xata.db.teams.update(team.xata_id, { name: 'Team boats' });

    expect(update1?.xata_id).toBe(team.xata_id);
    expect(update1?.name).toBe('Team boats');

    const update2 = await xata.db.teams.update({ xata_id: team.xata_id, name: 'Team planes' });

    expect(update2?.xata_id).toBe(team.xata_id);
    expect(update2?.name).toBe('Team planes');

    const update3 = await xata.db.teams.update([{ xata_id: team.xata_id, name: 'Team cars' }]);

    expect(update3[0]?.xata_id).toBe(team.xata_id);
    expect(update3[0]?.name).toBe('Team cars');

    const update4 = await update1?.update({ name: 'Team trains' });

    expect(update4?.xata_id).toBe(team.xata_id);
    expect(update4?.name).toBe('Team trains');

    const update5 = await update1?.update({ xata_id: update1?.xata_id, name: 'Team boats' });

    expect(update5?.xata_id).toBe(team.xata_id);
    expect(update5?.name).toBe('Team boats');

    const copy = await update2?.read();

    expect(copy?.xata_id).toBe(team.xata_id);
    expect(copy?.name).toBe('Team boats');
  });

  test.skip('update with numeric operations', async () => {
    const pet = await xata.db.pets.create({ name: 'Pet', num_legs: 1 });

    const update1 = await xata.db.pets.update(pet.xata_id, { num_legs: { $increment: 3 } });
    expect(update1?.num_legs).toBe(4);

    const update2 = await xata.db.pets.update({ xata_id: pet.xata_id, num_legs: { $divide: 2 } });
    expect(update2?.num_legs).toBe(2);

    const update3 = await xata.db.pets.update([{ xata_id: pet.xata_id, num_legs: { $multiply: 2 } }]);
    expect(update3[0]?.num_legs).toBe(4);

    const update4 = await xata.db.pets.update(pet.xata_id, { num_legs: { $decrement: 4 } });
    expect(update4?.num_legs).toBe(0);
  });
});
