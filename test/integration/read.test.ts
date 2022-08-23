import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment } from '../utils/setup';

let xata: XataClient;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const result = await setUpTestEnvironment('read');

  xata = result.client;
  cleanup = result.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('record read', () => {
  test('read single team with id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const copy = await xata.db.teams.read(team.id);

    expect(copy).toBeDefined();
    expect(copy?.id).toBe(team.id);
  });

  test('read multiple teams ', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await xata.db.teams.read(teams);

    expect(copies).toHaveLength(2);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);
  });

  test('read multiple teams with id list', async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await xata.db.teams.read(teams.map((team) => team.id));

    expect(copies).toHaveLength(2);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);
  });

  test("read single and return null if team doesn't exist", async () => {
    const copy = await xata.db.teams.read('does-not-exist');
    expect(copy).toBeNull();
  });

  test("read multiple teams with id list and ignores a team if doesn't exist", async () => {
    const teams = await xata.db.teams.create([{ name: 'Team cars' }, { name: 'Team planes' }]);

    const copies = await xata.db.teams.read(teams.map((team) => team.id).concat(['does-not-exist']));

    expect(copies).toHaveLength(3);
    expect(copies[0]?.id).toBe(teams[0].id);
    expect(copies[1]?.id).toBe(teams[1].id);
    expect(copies[2]).toBeNull();
  });

  test('read multiple with empty array', async () => {
    const copies = await xata.db.teams.read([]);
    expect(copies).toHaveLength(0);
  });

  test('read multiple with falsy values', async () => {
    const items = [null, undefined, false, 0, ''];

    // @ts-ignore
    const result = await xata.db.teams.read(items);

    expect(result).toHaveLength(items.length);
    expect(result).toEqual(items.map(() => null));
  });

  test('records are readonly', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    expect(Object.getOwnPropertyDescriptor(team, 'name')?.writable).toBe(false);

    try {
      // @ts-ignore
      team.name = 'New name';

      throw new Error('Unknown error');
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
    }
  });
});
