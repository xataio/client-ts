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
  test('read returns json', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: { hello: 'world' } });
    const read = await xata.db.teams.read(record.xata_id, ['config']);
    expect(read?.config.hello).toBe('world');
  });

  test('summarize returns json', async () => {
    await xata.db.teams.create({ name: 'test', config: { hello: 'world' } });
    const summarize = await xata.db.teams.summarize({
      columns: ['config'],
      summaries: {}
    });
    expect(summarize?.summaries[0].config.hello).toBe('world');
  });

  test('create file with JSON as object', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: { hello: 'world' } });

    expect(record.config.hello).toBe('world');

    await xata.db.teams.delete(record.xata_id);
  });

  test('create file with JSON as string', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: '{"hello":"world"}' });

    expect(record.config.hello).toBe('world');

    await xata.db.teams.delete(record.xata_id);
  });

  test('create file with JSON array as object', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: [{ hello: ['world'] }] });

    expect(record.config[0].hello[0]).toBe('world');

    await xata.db.teams.delete(record.xata_id);
  });

  test('create file with JSON array as string', async () => {
    const record = await xata.db.teams.create({ name: 'test', config: '[{"hello":["world"]}]' });

    expect(record.config[0].hello[0]).toBe('world');

    await xata.db.teams.delete(record.xata_id);
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
    expect(filterEquals[0].xata_id).toBe(r2.xata_id);

    const filterNodeEqualsString = await xata.db.teams.filter('config->bg->path', 'a/b/c').getAll();
    expect(filterNodeEqualsString.length).toBe(2);

    const filterNodeEqualsNumber = await xata.db.teams.filter('config->bg->alpha', 0.8).getAll();
    expect(filterNodeEqualsNumber.length).toBe(1);
    expect(filterNodeEqualsNumber[0].xata_id).toBe(r1.xata_id);

    const filterNodeGreaterThan = await xata.db.teams.filter('config->bg->alpha', { $gt: 0.5 }).getAll();
    expect(filterNodeGreaterThan.length).toBe(1);
    expect(filterNodeGreaterThan[0].xata_id).toBe(r1.xata_id);

    const filterNodeLessThan = await xata.db.teams.filter('config->bg->alpha', { $lt: 0.5 }).getAll();
    expect(filterNodeLessThan.length).toBe(1);
    expect(filterNodeLessThan[0].xata_id).toBe(r2.xata_id);

    const filterNodeEqualsNumberNotFound = await xata.db.teams.filter('config->bg->alpha', 1).getAll();
    expect(filterNodeEqualsNumberNotFound.length).toBe(0);

    const filterNodeNot = await xata.db.teams.filter({ $not: { 'config->bg->alpha': 1 } }).getAll();
    expect(filterNodeNot.length).toBe(2);

    const filterNodeIsNot = await xata.db.teams.filter({ 'config->bg->alpha': { $isNot: 0.8 } }).getAll();
    expect(filterNodeIsNot.length).toBe(1);

    const filterNodeContains = await xata.db.teams.filter({ 'config->bg->path': { $contains: 'a/b' } }).getAll();
    expect(filterNodeContains.length).toBe(2);
    expect(filterNodeContains.map((r) => r.name).sort()).toEqual(['r1', 'r2']);

    await xata.db.teams.delete([r1, r2]);
  });

  test('sorts work with JSON fields', async () => {
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

    await xata.db.teams.delete([r1, r2]);
  });

  test('create and query JSON', async () => {
    const record1 = await xata.db.teams.create({
      name: 'Xata xwag T-shirt',
      config: {
        color: 'purple',
        size: 'M'
      }
    });
    const record2 = await xata.db.teams.create({
      name: 'Meditations',
      config: {
        author: 'Marcus Aurelius',
        isbn: '978-0140449334',
        pages: 304
      }
    });
    const record3 = await xata.db.teams.create({
      name: 'Long climbing rope',
      config: {
        length: 80,
        thickness: 9.8,
        color: 'blue'
      }
    });

    const recordsBySizeM = await xata.db.teams.filter({ 'config->size': 'M' }).getMany();
    expect(recordsBySizeM.length).toBe(1);
    expect(recordsBySizeM[0].xata_id).toBe(record1.xata_id);

    const recordsLengthGreater = await xata.db.teams.filter({ 'config->length': { $gt: 50 } }).getMany();
    expect(recordsLengthGreater.length).toBe(1);
    expect(recordsLengthGreater[0].xata_id).toBe(record3.xata_id);

    const recordsBySubstring = await xata.db.teams.filter({ 'config->isbn': { $contains: '0140449334' } }).getMany();
    expect(recordsBySubstring.length).toBe(1);
    expect(recordsBySubstring[0].xata_id).toBe(record2.xata_id);

    const recordsWithNegationOperator = await xata.db.teams.filter({ 'config->color': { $isNot: 'yellow' } }).getMany();
    expect(recordsWithNegationOperator.length).toBe(2);
    expect(recordsWithNegationOperator.map((r) => r.name).sort()).toEqual(['Long climbing rope', 'Xata xwag T-shirt']);
  });
});
