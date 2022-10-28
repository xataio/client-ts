import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('createOrReplace');

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

describe('record create or replace', () => {
  test('create or replace single team with id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships', email: 'ships@ilovethem.com' });

    expect(team.read).toBeDefined();
    expect(team.email).toBe('ships@ilovethem.com');
    expect(team.name).toBe('Team ships');

    const replacedTeam = await xata.db.teams.createOrReplace(team.id, { name: 'Team boats' });

    expect(replacedTeam.id).toBe(team.id);
    expect(replacedTeam.read).toBeDefined();
    expect(replacedTeam.email).toBeNull();

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(replacedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
    expect(apiTeam?.email).toBeNull();
  });

  test('create or replace team with inline id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships', email: 'ships2@example.com' });

    expect(team.read).toBeDefined();
    expect(team.email).toBe('ships2@example.com');

    const replacedTeam = await xata.db.teams.createOrReplace({ id: team.id, name: 'Team boats' });

    expect(replacedTeam.id).toBe(team.id);
    expect(replacedTeam.read).toBeDefined();
    expect(replacedTeam.email).toBeNull();

    const apiTeam = await xata.db.teams.filter({ id: team.id }).getFirst();

    expect(replacedTeam.name).toBe('Team boats');
    expect(apiTeam?.name).toBe('Team boats');
    expect(apiTeam?.email).toBeNull();
  });

  test('create or replace multiple teams', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships', email: 'ships3@example.com' });

    expect(team.read).toBeDefined();
    expect(team.email).toBe('ships3@example.com');

    const replacedTeam = await xata.db.teams.createOrReplace([
      { id: team.id, name: 'Team boats' },
      { ...team, id: 'planes' }
    ]);

    expect(replacedTeam[0].id).toBe(team.id);
    expect(replacedTeam[0].read).toBeDefined();
    expect(replacedTeam[0].email).toBeNull();
    expect(replacedTeam[1].id).toBe('planes');
    expect(replacedTeam[1].read).toBeDefined();
    expect(replacedTeam[1].email).toBe(team.email);
  });
});
