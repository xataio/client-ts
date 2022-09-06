import { afterAll, afterEach, beforeAll, beforeEach, expect, describe } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';
import { test } from '../utils/tracing';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('createOrUpdate');

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

describe('record create or update', () => {
  test('create or update single team with id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await xata.db.teams.createOrUpdate(team.id, { name: 'Team boats' });

    expect(updatedTeam.id).toBe(team.id);
    expect(updatedTeam.read).toBeDefined();

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(updatedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test('create or update team with inline id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await xata.db.teams.createOrUpdate({ id: team.id, name: 'Team boats' });

    expect(updatedTeam.id).toBe(team.id);
    expect(updatedTeam.read).toBeDefined();

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(updatedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test('create or update multiple teams', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const updatedTeams = await xata.db.teams.createOrUpdate(teams.map((team) => ({ id: team.id, name: 'Team boats' })));

    expect(updatedTeams).toHaveLength(2);
    expect(updatedTeams[0].read).toBeDefined();

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ id: t.id })) }).getAll();

    expect(apiTeams).toHaveLength(2);

    expect(apiTeams[0].name).toBe('Team boats');
    expect(apiTeams[1].name).toBe('Team boats');
  });

  test("create or update many with empty array doesn't create or update anything", async () => {
    const updatedTeams = await xata.db.teams.createOrUpdate([]);
    expect(updatedTeams).toHaveLength(0);
  });
});
