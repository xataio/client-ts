import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('create');

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

describe('record creation', () => {
  test('create single team without id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    expect(team.id).toBeDefined();
    expect(team.name).toBe('Team ships');
  });

  test('create multiple teams without ids', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }], ['*', 'owner.*']);

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBeDefined();
    expect(teams[0].name).toBe('Team cars');
    expect(teams[0].read).toBeDefined();
    expect(teams[1].id).toBeDefined();
    expect(teams[1].name).toBe('Team planes');
    expect(teams[1].read).toBeDefined();
    expect(teams[0].id).not.toBe(teams[1].id);

    expect(teams[0].labels).toBeNull();
    expect(teams[1].labels).toBeNull();

    expect(teams[0].owner).toBeNull();
    expect(teams[0].owner?.full_name).toBeUndefined();
    expect(teams[1].owner?.full_name).toBeUndefined();
  });

  test('create user with id', async () => {
    const user = await xata.db.users.create('a-unique-record-john-4', {
      full_name: 'John Doe 4',
      email: 'john4@doe.com'
    });

    const apiUser = await xata.db.users.filter({ id: user.id }).getFirst();
    if (!apiUser) throw new Error('No user found');

    expect(user.id).toBe('a-unique-record-john-4');
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe('John Doe 4');
    expect(user.full_name.startsWith('John')).toBe(true);

    expect(user.id).toBe(apiUser.id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);

    expect(
      xata.db.users.create('a-unique-record-john-4', {
        full_name: 'John Doe 5',
        email: 'john5@doe.com'
      })
    ).rejects.toHaveProperty('status', 422);
  });

  test('create user with inlined id', async () => {
    const user = await xata.db.users.create({
      id: 'a-unique-record-john-5',
      full_name: 'John Doe 5',
      email: 'john5@doe.com'
    });

    const apiUser = await xata.db.users.filter({ id: user.id }).getFirst();
    if (!apiUser) throw new Error('No user found');

    expect(user.id).toBe('a-unique-record-john-5');
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe('John Doe 5');

    expect(user.id).toBe(apiUser.id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);
  });

  test('create user with empty id is not allowed', async () => {
    expect(
      xata.db.users.create('', {
        full_name: 'John Doe 3',
        email: 'john3@doe.com'
      })
    ).rejects.toMatchInlineSnapshot(`[Error: The id can't be empty]`);
  });

  test('create user with empty inline id is not allowed', async () => {
    expect(
      xata.db.users.create({
        id: '',
        full_name: 'John Doe 3',
        email: 'john3@doe.com'
      })
    ).rejects.toMatchInlineSnapshot(`[Error: The id can't be empty]`);
  });

  test('create user with falsy id is not allowed', async () => {
    expect(
      //@ts-expect-error
      xata.db.users.create(null, {
        full_name: 'John Doe 3',
        email: 'john3@doe.com'
      })
    ).rejects.toMatchInlineSnapshot(`[Error: Invalid arguments for create method]`);
  });

  test("create multiple with empty array doesn't create anything", async () => {
    const teams = await xata.db.teams.create([]);
    expect(teams).toHaveLength(0);
  });

  test('create multiple some with id and others without id', async () => {
    const teams = await xata.db.teams.create([{ id: 'team_cars', name: 'Team cars' }, { name: 'Team planes' }]);

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBe('team_cars');
    expect(teams[0].name).toBe('Team cars');
    expect(teams[0].read).toBeDefined();
    expect(teams[1].id).toBeDefined();
    expect(teams[1].name).toBe('Team planes');
    expect(teams[1].read).toBeDefined();
  });

  test('create multiple with returning columns', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes', labels: ['foo'] }], ['id']);

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBeDefined();
    // @ts-expect-error
    expect(teams[0].name).not.toBeDefined();
    expect(teams[0].read).toBeDefined();
    expect(teams[1].id).toBeDefined();
    // @ts-expect-error
    expect(teams[1].name).not.toBeDefined();
    expect(teams[1].read).toBeDefined();

    const team1 = await teams[0].read();
    expect(team1?.id).toBe(teams[0].id);
    expect(team1?.name).toBe('Team cars');

    const team2 = await teams[1].read(['labels']);
    expect(team2?.id).toBe(teams[1].id);
    // @ts-expect-error
    expect(team2?.name).not.toBeDefined();
    expect(team2?.labels).toEqual(['foo']);
  });

  test('create single with returning columns', async () => {
    const team = await xata.db.teams.create({ name: 'Team cars' }, ['id', 'owner']);

    expect(team).toBeDefined();
    expect(team.id).toBeDefined();
    // @ts-expect-error
    expect(team.name).not.toBeDefined();
    expect(team.owner).toBeNull();
    expect(team.read).toBeDefined();

    const team1 = await team.read();
    expect(team1?.id).toBe(team.id);
    expect(team1?.name).toBe('Team cars');
  });

  test('create single with unique email', async () => {
    const data = { full_name: 'John Doe 3', email: 'unique@example.com' };
    const user = await xata.db.users.create(data);

    expect(user.id).toBeDefined();
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe(data.full_name);
    expect(user.email).toBe(data.email);

    await expect(xata.db.users.create(data)).rejects.toThrowError();
  });

  test('create single with notNull column and default value', async () => {
    const result = await xata.db.users.create({});

    expect(result.full_name).toBe('John Doe');
  });

  test('create and fail if already exists', async () => {
    const user1 = await xata.db.users.create({ full_name: 'John Doe 3', email: 'doe3@john.net' });

    expect(user1.id).toBeDefined();
    expect(user1.read).toBeDefined();
    expect(user1.full_name).toBe('John Doe 3');

    await expect(xata.db.users.create(user1)).rejects.toThrowError();
  });

  test('create multiple fails if one of them already exists', async () => {
    const user1 = await xata.db.users.create({ full_name: 'John Doe 4', email: 'doe4@john.net' });

    expect(user1.id).toBeDefined();
    expect(user1.read).toBeDefined();
    expect(user1.full_name).toBe('John Doe 4');

    await expect(
      xata.db.users.create([user1, { full_name: 'John Doe 5', email: 'doe5@john.net' }])
    ).rejects.toThrowError();
  });

  test('create more than the operation max', async () => {
    const users = await xata.db.users.create(
      Array.from({ length: 1500 }, (_, i) => ({
        full_name: `John Doe ${i}`,
        email: `doe${i}@maxout.com`
      }))
    );

    expect(users).toHaveLength(1500);
  });

  test('create with emoji and special characters', async () => {
    const teams = await xata.db.teams.create([
      { name: 'Team \n🚗', labels: ['\t🚗', '\n🚙', '\r\n🚕'], description: '\t🚗\n🚙\r\n🚕' },
      {
        name: 'Team \t🚀',
        labels: ['🚀', '🚁', '🛸'],
        description: `This is a long description
      that takes several
      lines to fill in 😜`
      }
    ]);

    expect(teams).toHaveLength(2);
    expect(teams[0].id).toBeDefined();
    expect(teams[0].name).toMatchInlineSnapshot(`
      "Team 
      🚗"
    `);
    expect(teams[0].labels).toMatchInlineSnapshot(`
      [
        "	🚗",
        "
      🚙",
        "
      🚕",
      ]
    `);
    expect(teams[0].description).toMatchInlineSnapshot(`
      "	🚗
      🚙
      🚕"
    `);

    expect(teams[1].id).toBeDefined();
    expect(teams[1].name).toMatchInlineSnapshot('"Team 	🚀"');
    expect(teams[1].labels).toMatchInlineSnapshot(`
      [
        "🚀",
        "🚁",
        "🛸",
      ]
    `);
    expect(teams[1].description).toMatchInlineSnapshot(`
      "This is a long description
            that takes several
            lines to fill in 😜"
    `);

    await teams[1].update({
      description: `This is a new description\tAnd it also has special characters
    &pound;©Å‰|®¸Øm*¿?èUäæ³¦ïµ'Óp@³aÎ>ÍÄL>öcâN9&¶¦c¢=¿î!?ã×\n\r\n\t😇`
    });

    const team = await teams[1].read();

    expect(team?.description).toMatchInlineSnapshot(`
      "This is a new description	And it also has special characters
          &pound;©Å‰|®¸Øm*¿?èUäæ³¦ïµ'Óp@³aÎ>ÍÄL>öcâN9&¶¦c¢=¿î!?ã×

      	😇"
    `);
  });
});
