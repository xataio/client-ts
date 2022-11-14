import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('transactions');

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

describe('insert transactions', () => {
  test('do nothing if body contains no operations', async () => {
    const response = await xata.transactions.run([]);

    expect(response.results).toEqual([]);
  });

  test('insert a record', async () => {
    const response = await xata.transactions.run([{ insert: { table: 'teams', record: { name: 'a' } } }]);

    expect(response.results).toEqual([{ operation: 'insert', id: expect.any(String), rows: 1 }]);

    await xata.db.teams.delete({ id: response.results[0]?.id });
  });

  test('insert by ID', async () => {
    const response = await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a' } } }]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1 }]);

    await xata.db.teams.delete({ id: 'i0' });
  });

  test('insert with createOnly and explicit ID', async () => {
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'a' }, createOnly: true } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1 }]);

    await xata.db.teams.delete({ id: 'i0' });
  });

  test('replace existing record if createOnly is unset', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 } } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1 }]);

    await xata.db.teams.delete({ id: 'i0' });
  });

  test('replace existing record if createOnly is false', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 }, createOnly: false } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1 }]);

    await xata.db.teams.delete({ id: 'i0' });
  });

  test('replace when ifVersion set', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 } } }]);
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'c', index: 2 }, ifVersion: 1 } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1 }]);

    await xata.db.teams.delete({ id: 'i0' });
  });

  test('mix of operations', async () => {
    await xata.transactions.run([{ insert: { table: 'users', record: { id: 'j0', full_name: 'z', index: 0 } } }]);

    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { name: 'a', index: 0 } } },
      { insert: { table: 'users', record: { id: 'j1', full_name: 'b', index: 1 } } },
      { insert: { table: 'teams', record: { id: 'i1', name: 'b', index: 1 }, createOnly: true } },
      { insert: { table: 'users', record: { id: 'j0', full_name: 'replaced', index: 2 }, ifVersion: 0 } }
    ]);

    expect(response.results).toEqual([
      { operation: 'insert', id: expect.any(String), rows: 1 },
      { operation: 'insert', id: 'j1', rows: 1 },
      { operation: 'insert', id: 'i1', rows: 1 },
      { operation: 'insert', id: 'j0', rows: 1 }
    ]);

    await xata.db.teams.delete({ id: response.results[0]?.id });
    await xata.db.teams.delete({ id: 'i1' });
    await xata.db.users.delete({ id: 'j1' });
    await xata.db.users.delete({ id: 'j0' });
  });
});
