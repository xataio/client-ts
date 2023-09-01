import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { TestEnvironmentResult, setUpTestEnvironment } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('json');

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

describe('JSON support', () => {
  test('create file with JSON as object', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: { hello: 'world' } });

    expect(record.config.hello).toBe('world');

    await xata.db.teams.delete(record.id);
  });

  test('create file with JSON as string', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: '{"hello":"world"}' });

    expect(record.config.hello).toBe('world');

    await xata.db.teams.delete(record.id);
  });

  test('create file with JSON array as object', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: [{ hello: ['world'] }] });

    expect(record.config[0].hello[0]).toBe('world');

    await xata.db.teams.delete(record.id);
  });

  test('create file with JSON array as string', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: '[{"hello":["world"]}]' });

    expect(record.config[0].hello[0]).toBe('world');

    await xata.db.teams.delete(record.id);
  });

  test('filters work with JSON fields', async () => {
    const r1 = await xata.db.teams.create({
      name: 'r1',
      index: 10,
      rating: 1,
      description: 'longer text goes here 👀\u000A \u0009',
      founded_date: '2022-01-01T00:00:00.000Z',
      config: {
        color: 'blue',
        bg: {
          path: 'a/b/c',
          alpha: 0.8
        }
      }
    });

    const r2 = await xata.db.teams.create({
      name: 'r2',
      index: 23,
      rating: 2.5,
      description: 'some description',
      founded_date: '2022-01-01T00:00:00.000-05:00',
      config: {
        color: 'red',
        bg: {
          path: 'a/b/c',
          alpha: 0.2
        }
      }
    });

    const filterEquals = await xata.db.teams
      .filter({
        config: JSON.stringify({
          color: 'red',
          bg: {
            path: 'a/b/c',
            alpha: 0.2
          }
        })
      })
      .getAll();

    expect(filterEquals.length).toBe(1);
    expect(filterEquals[0].id).toBe(r2.id);

    const filterNodeEqualsString = await xata.db.teams.filter('config->bg->path', 'a/b/c').getAll();
    expect(filterNodeEqualsString.length).toBe(2);
    expect(filterNodeEqualsString.map((r) => r.id)).toEqual([r1.id, r2.id]);

    const filterNodeEqualsNumber = await xata.db.teams.filter('config->bg->alpha', 0.8).getAll();
    expect(filterNodeEqualsNumber.length).toBe(1);
    expect(filterNodeEqualsNumber[0].id).toBe(r1.id);

    const filterNodeGreaterThan = await xata.db.teams.filter('config->bg->alpha', { $gt: 0.5 }).getAll();
    expect(filterNodeGreaterThan.length).toBe(1);
    expect(filterNodeGreaterThan[0].id).toBe(r1.id);

    const filterNodeLessThan = await xata.db.teams.filter('config->bg->alpha', { $lt: 0.5 }).getAll();
    expect(filterNodeLessThan.length).toBe(1);
    expect(filterNodeLessThan[0].id).toBe(r2.id);

    const filterNodeEqualsNumberNotFound = await xata.db.teams.filter('config->bg->alpha', 1).getAll();
    expect(filterNodeEqualsNumberNotFound.length).toBe(0);

    const filterNodeNot = await xata.db.teams.filter({ $not: { 'config->bg->alpha': 1 } }).getAll();
    expect(filterNodeNot.length).toBe(2);

    const filterNodeIsNot = await xata.db.teams.filter({ 'config->bg->alpha': { $isNot: 0.8 } }).getAll();
    expect(filterNodeIsNot.length).toBe(1);

    const filterNodeContains = await xata.db.teams.filter({ 'config->bg->path': { $contains: 'a/b' } }).getAll();
    expect(filterNodeContains.length).toBe(2);
    expect(filterNodeContains.map((r) => r.id)).toEqual([r1.id, r2.id]);
  });
});
