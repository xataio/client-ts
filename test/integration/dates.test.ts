import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { gte, is, lt } from '../../packages/client/src';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment } from '../utils/setup';

let xata: XataClient;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const result = await setUpTestEnvironment('dates');

  xata = result.client;
  cleanup = result.cleanup;
});

afterAll(async () => {
  await cleanup();
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
