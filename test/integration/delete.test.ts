import { afterAll, afterEach, beforeAll, beforeEach, expect, describe } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';
import { test } from '../utils/tracing';

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

    await xata.db.teams.delete(team.id);

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test('delete multiple teams with id list', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    await xata.db.teams.delete(teams.map((team) => team.id));

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(0);
  });

  test('delete single team with id in object', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    await xata.db.teams.delete(team);

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test('delete multiple teams with id in object', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    await xata.db.teams.delete(teams);

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(0);
  });

  test('delete team with own operation', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    await team.delete();

    const copy = await team.read();

    expect(copy).toBeNull();

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(apiTeam).toBeNull();
  });

  test('delete invalid items returns null', async () => {
    const valid = await xata.db.teams.create({ name: 'Team ships' });

    const team1 = await xata.db.teams.delete('invalid');
    const team2 = await xata.db.teams.delete({ id: 'invalid', name: 'Team boats' });
    const team3 = await xata.db.teams.delete([{ id: 'invalid', name: 'Team boats' }, valid]);

    expect(team1).toBeNull();
    expect(team2).toBeNull();
    expect(team3[0]).toBeNull();
    expect(team3[1]).toBeDefined();
    expect(team3[1]?.id).toBe(valid.id);
    expect(team3[1]?.name).toBe('Team ships');
  });
});
