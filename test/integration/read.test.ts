import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('read');

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

describe('record read', () => {
  test('read single team with id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const copy = await xata.db.teams.read(team.id);
    const definedCopy = await xata.db.teams.readOrThrow(team.id);

    expect(copy).toBeDefined();
    expect(copy?.id).toBe(team.id);
    expect(copy?.xata.createdAt).toBeInstanceOf(Date);

    expect(definedCopy).toBeDefined();
    expect(definedCopy.id).toBe(team.id);
    expect(definedCopy.xata.createdAt).toBeInstanceOf(Date);
  });

  test('read multiple teams ', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await xata.db.teams.read(teams);
    const definedCopies = await xata.db.teams.readOrThrow(teams);

    expect(copies).toHaveLength(2);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);

    expect(definedCopies).toHaveLength(2);
    expect(definedCopies[0].id).toBe(teams[0].id);
    expect(definedCopies[1].id).toBe(teams[1].id);
  });

  test('read multiple teams with id list', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await xata.db.teams.read(teams.map((team) => team.id));
    const definedCopies = await xata.db.teams.readOrThrow(teams.map((team) => team.id));

    expect(copies).toHaveLength(2);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);

    expect(definedCopies).toHaveLength(2);
    expect(definedCopies[0].id).toBe(teams[0].id);
    expect(definedCopies[1].id).toBe(teams[1].id);
  });

  test("read single and return null if team doesn't exist", async () => {
    const copy = await xata.db.teams.read('does-not-exist');
    expect(copy).toBeNull();
  });

  test("read single and throws if team doesn't exist", async () => {
    expect(xata.db.teams.readOrThrow('does-not-exist')).rejects.toThrow();
  });

  test("read multiple teams with id list and ignores a team if doesn't exist", async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await xata.db.teams.read(teams.map((team) => team.id).concat(['does-not-exist']));

    expect(copies).toHaveLength(3);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);
    expect(copies[2]).toBeNull();
  });

  test("read multiple teams with id list and throws if a team doesn't exist", async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);
    expect(xata.db.teams.readOrThrow(teams.map((team) => team.id).concat(['does-not-exist']))).rejects.toThrow();
  });

  test('read multiple with empty array', async () => {
    const copies = await xata.db.teams.read([]);
    expect(copies).toHaveLength(0);
  });

  test('read multiple with falsy values', async () => {
    const items = [null, undefined, false, 0, ''];

    // @ts-expect-error
    const result = await xata.db.teams.read(items);

    expect(result).toHaveLength(items.length);
    expect(result).toEqual(items.map(() => null));
  });

  test('records are readonly', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    expect(Object.getOwnPropertyDescriptor(team, 'name')?.writable).toBe(false);

    try {
      // @ts-expect-error
      team.name = 'New name';

      throw new Error('Unknown error');
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
    }
  });

  test('read multiple with falsy values, throws', async () => {
    const items = [null, undefined, false, 0, ''];

    // @ts-expect-error
    expect(xata.db.teams.readOrThrow(items)).rejects.toThrow();
  });

  test('read with columns', async () => {
    const owner = await xata.db.users.create({ full_name: 'John', street: 'Newark' });
    const team = await xata.db.teams.create({ name: 'Team ships', labels: ['foo', 'bar'], owner });

    const copy = await xata.db.teams.read(team.id, ['id', 'name', 'owner.street']);

    expect(copy).toBeDefined();
    expect(copy?.id).toBe(team.id);
    expect(copy?.name).toBe(team.name);
    // @ts-expect-error
    expect(copy?.labels).not.toBeDefined();
    expect(copy?.owner).toBeDefined();
    expect(copy?.owner?.id).toBe(owner.id);
    expect(copy?.owner?.street).toBe(owner.street);
    // @ts-expect-error
    expect(copy?.owner?.city).not.toBeDefined();
    // @ts-expect-error
    expect(copy?.owner?.full_name).not.toBeDefined();
  });

  test('replace team with record method', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships', email: 'shipm4@test.com' });

    expect(team.read).toBeDefined();
    expect(team.email).toBe('shipm4@test.com');

    const replacedTeam = await team.replace({ name: 'Team boats' });

    expect(replacedTeam?.id).toBe(team.id);
    expect(replacedTeam?.read).toBeDefined();
    expect(replacedTeam?.email).toBeNull();
  });
});
