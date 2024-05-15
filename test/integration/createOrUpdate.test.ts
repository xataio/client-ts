import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

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

    const updatedTeam = await xata.db.teams.createOrUpdate(team.xata_id, { name: 'Team boats' });

    expect(updatedTeam.xata_id).toBe(team.xata_id);
    expect(updatedTeam.read).toBeDefined();

    const apiTeam = await xata.db.teams.filter({ xata_id: team.xata_id }).getFirst();

    expect(updatedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test('create or update with optional id', async () => {
    const xata_id: string | undefined = undefined;

    const team = await xata.db.teams.createOrUpdate(xata_id, { name: 'Team ships' });
    expect(team.xata_id).toBeDefined();
  });

  test('create or update fails with empty id', async () => {
    const xata_id: string | undefined = '';

    await expect(xata.db.teams.createOrUpdate(xata_id, { name: 'Team ships' })).rejects.toThrowError();
  });

  test('create or update team with inline id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const updatedTeam = await xata.db.teams.createOrUpdate({ xata_id: team.xata_id, name: 'Team boats' });

    expect(updatedTeam.xata_id).toBe(team.xata_id);
    expect(updatedTeam.read).toBeDefined();

    const apiTeam = await xata.db.teams.filter({ xata_id: team.xata_id }).getFirst();

    expect(updatedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
  });

  test('create or update multiple teams', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const updatedTeams = await xata.db.teams.createOrUpdate(
      teams.map((team) => ({ xata_id: team.xata_id, name: 'Team boats' }))
    );

    expect(updatedTeams).toHaveLength(2);
    expect(updatedTeams[0].read).toBeDefined();
    expect(updatedTeams[1].read).toBeDefined();
    expect(updatedTeams[0].xata_id).toBe(teams[0].xata_id);
    expect(updatedTeams[1].xata_id).toBe(teams[1].xata_id);
    expect(updatedTeams[0].name).toBe('Team boats');
    expect(updatedTeams[1].name).toBe('Team boats');

    const apiTeams = await xata.db.teams.filter({ $any: teams.map((t) => ({ xata_id: t.xata_id })) }).getAll();

    expect(apiTeams).toHaveLength(2);

    expect(apiTeams[0].name).toBe('Team boats');
    expect(apiTeams[1].name).toBe('Team boats');
  });

  test("create or update many with empty array doesn't create or update anything", async () => {
    const updatedTeams = await xata.db.teams.createOrUpdate([]);
    expect(updatedTeams).toHaveLength(0);
  });

  test('create or update many without getting rate limited', async () => {
    const newUsers = Array.from({ length: 250 }).map((_, i) => ({ xata_id: `user-${i}`, full_name: `user-${i}` }));
    const result = await Promise.all(newUsers.map((user) => xata.db.users.createOrUpdate(user, ['xata_id'])));

    expect(result).toHaveLength(250);
    expect(result.every((item) => item.xata_id)).toBeTruthy();
  }, 100000);
});
