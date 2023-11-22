import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { TestEnvironmentResult, setUpTestEnvironment } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('revlinks');

  xata = result.client;
  hooks = result.hooks;

  return hooks.beforeAll(ctx);
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

describe('Revlinks', () => {
  test('create user and team and link them', async () => {
    const user = await xata.db.users.create({ name: 'test' });
    const team = await xata.db.teams.create({ name: 'test', owner: user });

    expect(team.owner?.id).toBe(user.id);

    const records = await xata.db.users
      .select([
        '*',
        {
          name: '<-teams.owner',
          as: 'ownerTeams',
          sort: [{ name: 'desc' }],
          columns: ['name'],
          limit: 10
        }
      ])
      .getAll();

    expect(records).toHaveLength(1);
    expect(records[0]?.ownerTeams?.records).toHaveLength(1);
    expect(records[0]?.ownerTeams?.records[0]?.name).toBe(team.name);

    await xata.db.users.delete(user.id);
    await xata.db.teams.delete(team.id);
  });
});
