import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('delete');

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

describe('record deletion', () => {
  test('delete single team with id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    await xata.db.teams.delete(team.xata_id);

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await xata.db.teams.filter({ xata_id: team.xata_id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test.skip('delete multiple teams with id list', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const result = await xata.db.teams.delete(teams.map((team) => team.xata_id));

    expect(result.length).toBe(2);
    expect(result[0]?.xata_id).toBe(teams[0].xata_id);
    expect(result[1]?.xata_id).toBe(teams[1].xata_id);
    expect(result[0]?.read).toBeDefined();
    expect(result[1]?.read).toBeDefined();
    expect(result[0]?.name).toBe('Team cars');
    expect(result[1]?.name).toBe('Team planes');

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ xata_id: t.xata_id })) }).getAll();

    expect(apiTeams).toHaveLength(0);
  });

  test('delete single team with id in object', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    await xata.db.teams.delete(team);

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await xata.db.teams.filter({ xata_id: team.xata_id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test.skip('delete multiple teams with id in object', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    await xata.db.teams.delete(teams);

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ xata_id: t.xata_id })) }).getAll();

    expect(apiTeams).toHaveLength(0);
  });

  test.skip('delete multiple teams with invalid', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const result = await xata.db.teams.delete([...teams, { xata_id: 'invalid' }]);

    expect(result.length).toBe(3);
    expect(result[0]?.xata_id).toBe(teams[0].xata_id);
    expect(result[1]?.xata_id).toBe(teams[1].xata_id);
    expect(result[0]?.read).toBeDefined();
    expect(result[1]?.read).toBeDefined();
    expect(result[0]?.name).toBe('Team cars');
    expect(result[1]?.name).toBe('Team planes');
    expect(result[2]).toBeNull();

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ xata_id: t.xata_id })) }).getAll();
    expect(apiTeams).toHaveLength(0);
  });

  test('delete team with own operation', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    await team.delete();

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await xata.db.teams.filter({ xata_id: team.xata_id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test('delete invalid items returns null', async () => {
    const valid = await xata.db.teams.create({ name: 'Team ships' });

    const team1 = await xata.db.teams.delete('invalid');
    const team2 = await xata.db.teams.delete({ xata_id: 'invalid', name: 'Team boats' });
    const team3 = await xata.db.teams.delete([{ xata_id: 'invalid', name: 'Team boats' }, valid]);

    expect(team1).toBeNull();
    expect(team2).toBeNull();
    expect(team3[0]).toBeNull();
    expect(team3[1]).toBeDefined();
    expect(team3[1]?.xata_id).toBe(valid.xata_id);
    expect(team3[1]?.name).toBe('Team ships');
  });

  test('delete twice and throws', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const result = await xata.db.teams.delete(team);
    expect(result?.xata_id).toBe(team.xata_id);

    const result2 = await xata.db.teams.delete(team);
    expect(result2).toBeNull();

    const result3 = await result?.delete();
    expect(result3).toBeNull();

    await expect(xata.db.teams.deleteOrThrow(team)).rejects.toThrow();
  });
});
