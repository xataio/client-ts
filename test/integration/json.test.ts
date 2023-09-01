import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { File } from 'web-file-polyfill';
import { XataClient } from '../../packages/codegen/example/xata';
import { TestEnvironmentResult, setUpTestEnvironment } from '../utils/setup';
import { XataFile } from '../../packages/client/src';

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
    const record = await xata.db.teams.create({ name: 'test', json: { hello: 'world' } });

    expect(record.json.hello).toBe('world');
  });

  test('create file with JSON as string', async () => {
    const record = await xata.db.teams.create({ name: 'test', json: '{"hello":"world"}' });

    expect(record.json.hello).toBe('world');
  });

  test('create file with JSON array as object', async () => {
    const record = await xata.db.teams.create({ name: 'test', json: [{ hello: ['world'] }] });

    expect(record.json[0].hello[0]).toBe('world');
  });

  test('create file with JSON array as string', async () => {
    const record = await xata.db.teams.create({ name: 'test', json: '[{"hello":["world"]}]' });

    expect(record.json[0].hello[0]).toBe('world');
  });
});
