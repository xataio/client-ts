import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { gte, is, lt } from '../../packages/client/src';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('dates');

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

describe('dates', () => {
  test('add a record with a date', async () => {
    const birthDate = new Date();
    const record = await xata.db.users.create({ birthDate });

    expect(record.birthDate instanceof Date).toEqual(true);
    expect(record.birthDate?.toISOString()).toEqual(birthDate.toISOString());
  });

  test('add a record without a date (optional)', async () => {
    const record = await xata.db.users.create({});

    expect(record.birthDate).toBeUndefined();
  });

  test('filter date with operators', async () => {
    const birthDate = new Date();
    await xata.db.users.create({ birthDate });

    const exact = await xata.db.users.filter('birthDate', is(birthDate)).getFirst();
    const notFound = await xata.db.users.filter('birthDate', gte(new Date())).getFirst();
    const found = await xata.db.users
      .filter('birthDate', lt(new Date()))
      .filter('birthDate', gte(birthDate))
      .getFirst();

    expect(exact?.birthDate?.toISOString()).toEqual(birthDate.toISOString());
    expect(notFound).toBeNull();
    expect(found?.birthDate?.toISOString()).toEqual(birthDate.toISOString());
  });
});
