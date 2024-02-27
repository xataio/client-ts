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

    await xata.db.teams.delete({ xata_id: response.results[0]?.id });
  });

  test('insert by ID', async () => {
    const response = await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a' } } }]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1, columns: {} }]);

    await xata.db.teams.delete({ xata_id: 'i0' });
  });

  test('insert with createOnly and explicit ID', async () => {
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'a' }, createOnly: true } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1 }]);

    await xata.db.teams.delete({ xata_id: 'i0' });
  });

  test('replace existing record if createOnly is unset', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 } } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1, columns: {} }]);

    await xata.db.teams.delete({ xata_id: 'i0' });
  });

  test('replace existing record if createOnly is false', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 }, createOnly: false } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1, columns: {} }]);

    await xata.db.teams.delete({ xata_id: 'i0' });
  });

  test('replace when ifVersion set', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 } } }]);
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'c', index: 2 }, ifVersion: 1 } }
    ]);

    expect(response.results).toEqual([{ operation: 'insert', id: 'i0', rows: 1, columns: {} }]);

    await xata.db.teams.delete({ xata_id: 'i0' });
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
      { operation: 'insert', id: 'j1', rows: 1, columns: {} },
      { operation: 'insert', id: 'i1', rows: 1 },
      { operation: 'insert', id: 'j0', rows: 1, columns: {} }
    ]);

    await xata.db.teams.delete({ xata_id: response.results[0]?.id });
    await xata.db.teams.delete({ xata_id: 'i1' });
    await xata.db.users.delete({ xata_id: 'j1' });
    await xata.db.users.delete({ xata_id: 'j0' });
  });
});

describe('update transactions', () => {
  test('update records', async () => {
    await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 1 } } },
      { insert: { table: 'teams', record: { id: 'i1', name: 'b', index: 10 } } },
      { insert: { table: 'teams', record: { id: 'i2', name: 'c', index: 100 } } }
    ]);

    const response = await xata.transactions.run([
      { update: { table: 'teams', id: 'i0', fields: { name: 'a1' } } },
      { update: { table: 'teams', id: 'i1', fields: { name: 'b1' } } },
      { update: { table: 'teams', id: 'i2', fields: { name: 'c1' } } },
      { update: { table: 'teams', id: 'i2', fields: { name: 'c1.1' } } }
    ]);

    expect(response.results).toEqual([
      { operation: 'update', id: 'i0', rows: 1, columns: {} },
      { operation: 'update', id: 'i1', rows: 1, columns: {} },
      { operation: 'update', id: 'i2', rows: 1, columns: {} },
      { operation: 'update', id: 'i2', rows: 1, columns: {} }
    ]);

    const records = await xata.db.teams.read(['i0', 'i1', 'i2']);
    expect(records[0]?.name).toEqual('a1');
    expect(records[1]?.name).toEqual('b1');
    expect(records[2]?.name).toEqual('c1.1');

    await xata.db.teams.delete(['i0', 'i1', 'i2']);
  });

  test('update ifVersion', async () => {
    await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } },
      { insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 } } }
    ]);

    const response = await xata.transactions.run([
      { update: { table: 'teams', id: 'i0', fields: { name: 'c', index: 2 }, ifVersion: 1 } }
    ]);

    expect(response.results).toEqual([{ operation: 'update', id: 'i0', rows: 1, columns: {} }]);

    const record = await xata.db.teams.read('i0');
    expect(record?.name).toEqual('c');
    expect(record?.index).toEqual(2);

    await xata.db.teams.delete('i0');
  });

  test('update an insert from same tx', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 0 } } }]);

    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i1', name: 'b', index: 1 } } },
      { update: { table: 'teams', id: 'i0', fields: { name: 'c', index: 2 } } },
      { update: { table: 'teams', id: 'i1', fields: { name: 'd', index: 3 } } }
    ]);

    expect(response.results).toEqual([
      { operation: 'insert', id: 'i1', rows: 1, columns: {} },
      { operation: 'update', id: 'i0', rows: 1, columns: {} },
      { operation: 'update', id: 'i1', rows: 1, columns: {} }
    ]);

    const records = await xata.db.teams.read(['i0', 'i1']);
    expect(records[0]?.name).toEqual('c');
    expect(records[0]?.index).toEqual(2);
    expect(records[1]?.name).toEqual('d');
    expect(records[1]?.index).toEqual(3);

    await xata.db.teams.delete(['i0', 'i1']);
  });

  test('upsert should insert record if it does not exist', async () => {
    const response = await xata.transactions.run([
      { update: { table: 'teams', id: 'i0', fields: { name: 'a', index: 0 }, upsert: true } }
    ]);

    expect(response.results).toEqual([{ operation: 'update', id: 'i0', rows: 1, columns: {} }]);

    const record = await xata.db.teams.read('i0');
    expect(record?.name).toEqual('a');
    expect(record?.index).toEqual(0);

    await xata.db.teams.delete('i0');
  });

  test('upsert should update record if it already exists', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);

    const response = await xata.transactions.run([
      { update: { table: 'teams', id: 'i0', fields: { name: 'b', index: 1 }, upsert: true } }
    ]);

    expect(response.results).toEqual([{ operation: 'update', id: 'i0', rows: 1, columns: {} }]);

    const record = await xata.db.teams.read('i0');
    expect(record?.name).toEqual('b');
    expect(record?.index).toEqual(1);

    await xata.db.teams.delete('i0');
  });

  test('upsert with ifVersion', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);
    // update i0 to version 1
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'b', index: 1 } } }]);

    const response = await xata.transactions.run([
      { update: { table: 'teams', id: 'i0', fields: { name: 'c' }, upsert: true, ifVersion: 1 } }
    ]);

    expect(response.results).toEqual([{ operation: 'update', id: 'i0', rows: 1, columns: {} }]);

    const record = await xata.db.teams.read('i0');
    expect(record?.name).toEqual('c');
    expect(record?.index).toEqual(1);

    await xata.db.teams.delete('i0');
  });
});

describe('delete transactions', () => {
  test('delete a record', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);

    const response = await xata.transactions.run([{ delete: { table: 'teams', id: 'i0' } }]);

    expect(response.results).toEqual([{ operation: 'delete', rows: 1 }]);

    const record = await xata.db.teams.read('i0');
    expect(record).toBeNull();
  });

  test('delete a record from same transaction', async () => {
    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } },
      { delete: { table: 'teams', id: 'i0' } }
    ]);

    expect(response.results).toEqual([
      { operation: 'insert', id: 'i0', rows: 1, columns: {} },
      { operation: 'delete', rows: 1 }
    ]);

    const record = await xata.db.teams.read('i0');
    expect(record).toBeNull();
  });

  test('delete that affects no records does not abort transaction', async () => {
    await xata.transactions.run([{ insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } }]);

    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i1', name: 'b', index: 1 } } },
      { delete: { table: 'teams', id: 'i2' } }
    ]);

    expect(response.results).toEqual([
      { operation: 'insert', id: 'i1', rows: 1, columns: {} },
      { operation: 'delete', rows: 0 }
    ]);

    const record = await xata.db.teams.read('i1');
    expect(record?.name).toEqual('b');
    expect(record?.index).toEqual(1);

    await xata.db.teams.delete('i1');
  });

  test('delete with failIfMissing', async () => {
    const records = await xata.transactions.run([{ delete: { table: 'teams', id: 'ab', failIfMissing: false } }]);

    expect(records).toEqual({ results: [{ operation: 'delete', rows: 0 }] });

    try {
      await xata.transactions.run([{ delete: { table: 'teams', id: 'ab', failIfMissing: true } }]);
    } catch (error: any) {
      expect(error.errors).toEqual([{ index: 0, message: 'table [teams]: no rows deleted' }]);
      return;
    }

    throw new Error('should not reach here');
  });
});

describe('combined transactions', () => {
  test('insert, update, delete', async () => {
    await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i0', name: 'a', index: 0 } } },
      { insert: { table: 'teams', record: { id: 'i1', name: 'b', index: 1 } } },
      { insert: { table: 'teams', record: { id: 'i2', name: 'c', index: 2 } } }
    ]);

    const response = await xata.transactions.run([
      { insert: { table: 'teams', record: { id: 'i3', name: 'd', index: 3 } } },
      { update: { table: 'teams', id: 'i0', fields: { name: 'a1' } } },
      { update: { table: 'teams', id: 'i1', fields: { name: 'b1' } } },
      { update: { table: 'teams', id: 'i2', fields: { name: 'c1' } } },
      { update: { table: 'teams', id: 'i2', fields: { name: 'c1.1' } } },
      { delete: { table: 'teams', id: 'i3' } },
      { get: { table: 'teams', id: 'i0', columns: ['xata_id', 'index', 'name'] } },
      { get: { table: 'teams', id: 'i1', columns: ['xata_id', 'index', 'name'] } },
      { get: { table: 'teams', id: 'i2', columns: ['xata_id', 'index', 'name'] } }
    ]);

    expect(response.results).toEqual([
      { operation: 'insert', id: 'i3', rows: 1, columns: {} },
      { operation: 'update', id: 'i0', rows: 1, columns: {} },
      { operation: 'update', id: 'i1', rows: 1, columns: {} },
      { operation: 'update', id: 'i2', rows: 1, columns: {} },
      { operation: 'update', id: 'i2', rows: 1, columns: {} },
      { operation: 'delete', rows: 1 },
      { operation: 'get', columns: { xata_id: 'i0', name: 'a1', index: 0 } },
      { operation: 'get', columns: { xata_id: 'i1', name: 'b1', index: 1 } },
      { operation: 'get', columns: { xata_id: 'i2', name: 'c1.1', index: 2 } }
    ]);

    const records = await xata.db.teams.read(['i0', 'i1', 'i2']);
    expect(records[0]?.name).toEqual('a1');
    expect(records[1]?.name).toEqual('b1');
    expect(records[2]?.name).toEqual('c1.1');

    await xata.db.teams.delete(['i0', 'i1', 'i2']);
  });
});
