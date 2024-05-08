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
  test('create single user without id', async () => {
    const user = await xata.db.users.create({ name: 'User ships', birthDate: new Date() });
    expect(user.xata_id).toBeDefined();
    expect(user.name).toBe('User ships');
    expect(user.read).toBeDefined();
    expect(user.birthDate).toBeInstanceOf(Date);

    expect(user.xata_createdat).toBeInstanceOf(Date);
    expect(user.xata_updatedat).toBeInstanceOf(Date);
    expect(user.xata_version).toBe(0);

    const json = user.toSerializable();

    expect(json.xata_createdat).toBeDefined();
    expect(json.xata_updatedat).toBeDefined();
    expect(json.xata_version).toBe(0);

    expect(json.xata_id).toBeDefined();
    expect(json.name).toBe('User ships');
    // @ts-expect-error
    expect(json.read).not.toBeDefined();
    expect(typeof json.birthDate).toBe('string');
  });

  test('create user with team', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });
    const user = await xata.db.users.create({ name: 'User ships', team }, ['*']);

    expect(user.xata_id).toBeDefined();
    expect(user.name).toBe('User ships');
    expect(user.read).toBeDefined();
    expect(user.team).toBeDefined();

    expect(user.xata_createdat).toBeInstanceOf(Date);
    expect(user.xata_updatedat).toBeInstanceOf(Date);
    expect(user.xata_version).toBe(0);

    const json = user.toSerializable();

    expect(json.xata_id).toBeDefined();
    expect(json.name).toBe('User ships');
    // @ts-expect-error
    expect(json.read).not.toBeDefined();
    expect(json.team).toBeDefined();
  });

  // TODO figure out what to do aobut transactions
  test.skip('create multiple teams without ids', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }], ['*', 'owner.*']);

    expect(teams).toHaveLength(2);
    expect(teams[0].xata_id).toBeDefined();
    expect(teams[0].name).toBe('Team cars');
    expect(teams[0].read).toBeDefined();
    expect(teams[1].xata_id).toBeDefined();
    expect(teams[1].name).toBe('Team planes');
    expect(teams[1].read).toBeDefined();
    expect(teams[0].xata_id).not.toBe(teams[1].xata_id);

    expect(teams[0].labels).toBeNull();
    expect(teams[1].labels).toBeNull();

    expect(teams[0].owner).toBeNull();
    expect(teams[0].owner?.full_name).toBeUndefined();
    expect(teams[1].owner?.full_name).toBeUndefined();
  });

  // TODO propose getting rid of this 'recordId' API
  test('create user with id', async () => {
    const user = await xata.db.users.create('a-unique-record-john-4', {
      full_name: 'John Doe 4',
      email: 'john4@doe.com'
    });

    const apiUser = await xata.db.users.filter({ xata_id: user.xata_id }).getFirst();
    if (!apiUser) throw new Error('No user found');

    expect(user.xata_id).toBe('a-unique-record-john-4');
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe('John Doe 4');
    expect(user.full_name.startsWith('John')).toBe(true);

    expect(user.xata_id).toBe(apiUser.xata_id);
    expect(user.full_name).toBe(apiUser.full_name);
    expect(user.email).toBe(apiUser.email);

    expect(user.xata_createdat).toBeInstanceOf(Date);
    expect(apiUser.xata_createdat).toBeInstanceOf(Date);
    expect(user.xata_createdat.getTime()).toBe(apiUser.xata_createdat.getTime());

    expect(
      xata.db.users.create('a-unique-record-john-4', {
        full_name: 'John Doe 5',
        email: 'john5@doe.com'
      })
      // Kysely throws a 400 on constraint violation
    ).rejects.toHaveProperty('status', 400);
  });

  test('create user with inlined id', async () => {
    const user = await xata.db.users.create({
      xata_id: 'a-unique-record-john-5',
      full_name: 'John Doe 5',
      email: 'john5@doe.com'
    });

    const apiUser = await xata.db.users.filter({ xata_id: user.xata_id }).getFirst();
    if (!apiUser) throw new Error('No user found');

    expect(user.xata_id).toBe('a-unique-record-john-5');
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe('John Doe 5');

    expect(user.xata_id).toBe(apiUser.xata_id);
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
        xata_id: '',
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

  test.skip("create multiple with empty array doesn't create anything", async () => {
    const teams = await xata.db.teams.create([]);
    expect(teams).toHaveLength(0);
  });

  test.skip('create multiple some with id and others without id', async () => {
    const teams = await xata.db.teams.create([{ xata_id: 'team_cars', name: 'Team cars' }, { name: 'Team planes' }]);

    expect(teams).toHaveLength(2);
    expect(teams[0].xata_id).toBe('team_cars');
    expect(teams[0].name).toBe('Team cars');
    expect(teams[0].read).toBeDefined();
    expect(teams[1].xata_id).toBeDefined();
    expect(teams[1].name).toBe('Team planes');
    expect(teams[1].read).toBeDefined();
  });

  test.skip('create multiple with returning columns', async () => {
    const teams = await xata.db.teams.create(
      [{ name: 'Team cars' }, { name: 'Team planes', labels: ['foo'] }],
      ['xata_id']
    );

    expect(teams).toHaveLength(2);
    expect(teams[0].xata_id).toBeDefined();
    // @ts-expect-error
    expect(teams[0].name).not.toBeDefined();
    expect(teams[0].read).toBeDefined();
    expect(teams[1].xata_id).toBeDefined();
    // @ts-expect-error
    expect(teams[1].name).not.toBeDefined();
    expect(teams[1].read).toBeDefined();

    const team1 = await teams[0].read();
    expect(team1?.xata_id).toBe(teams[0].xata_id);
    expect(team1?.name).toBe('Team cars');

    const team2 = await teams[1].read(['labels']);
    expect(team2?.xata_id).toBe(teams[1].xata_id);
    // @ts-expect-error
    expect(team2?.name).not.toBeDefined();
    expect(team2?.labels).toEqual(['foo']);
  });

  test('create single with returning columns', async () => {
    const team = await xata.db.teams.create({ name: 'Team cars' }, ['xata_id', 'owner']);

    expect(team).toBeDefined();
    expect(team.xata_id).toBeDefined();
    // @ts-expect-error
    expect(team.name).not.toBeDefined();
    expect(team.owner).toBeNull();
    expect(team.read).toBeDefined();
  });

  test('create single with unique email', async () => {
    const data = { full_name: 'John Doe 3', email: 'unique@example.com' };
    const user = await xata.db.users.create(data);

    expect(user.xata_id).toBeDefined();
    expect(user.read).toBeDefined();
    expect(user.full_name).toBe(data.full_name);
    expect(user.email).toBe(data.email);

    await expect(xata.db.users.create(data)).rejects.toThrowError();
  });

  // TODO kysely does not accept no value or empty object as input to insert
  test.skip('create single with notNull column and default value', async () => {
    const result = await xata.db.users.create({});

    expect(result.full_name).toBe('John Doe');
  });

  test('create and fail if already exists', async () => {
    const user1 = await xata.db.users.create({ full_name: 'John Doe 3', email: 'doe3@john.net' });

    expect(user1.xata_id).toBeDefined();
    expect(user1.read).toBeDefined();
    expect(user1.full_name).toBe('John Doe 3');

    await expect(xata.db.users.create(user1)).rejects.toThrowError();
  });

  test('create multiple fails if one of them already exists', async () => {
    const user1 = await xata.db.users.create({ full_name: 'John Doe 4', email: 'doe4@john.net' });

    expect(user1.xata_id).toBeDefined();
    expect(user1.read).toBeDefined();
    expect(user1.full_name).toBe('John Doe 4');

    await expect(
      xata.db.users.create([user1, { full_name: 'John Doe 5', email: 'doe5@john.net' }])
    ).rejects.toThrowError();
  });

  test.skip('create more than the operation max', async () => {
    const users = await xata.db.users.create(
      Array.from({ length: 1500 }, (_, i) => ({
        full_name: `John Doe ${i}`,
        email: `doe${i}@maxout.com`
      }))
    );

    expect(users).toHaveLength(1500);
  });

  test.skip('create with emoji and special characters', async () => {
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
    expect(teams[0].xata_id).toBeDefined();
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

    expect(teams[1].xata_id).toBeDefined();
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

  // Is xata_id always supposed to come back on the created record?
  test.skip("create link and read it's value", async () => {
    const user = await xata.db.users.create({ name: 'John Doe 3' });
    const team = await xata.db.teams.create({ name: 'Team cars', owner: user.xata_id }, ['owner']);
    expect(team).toBeDefined();
    expect(team.xata_id).toBeDefined();
    // @ts-expect-error
    expect(team.name).toBeUndefined();
    expect(team.owner).toBeDefined();
  });
});
