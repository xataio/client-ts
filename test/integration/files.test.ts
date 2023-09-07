import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { TestEnvironmentResult, setUpTestEnvironment } from '../utils/setup';
import { XataFile } from '../../packages/client/src';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('files');

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

const file = new Blob(['hello'], { type: 'text/plain' });
const json = new Blob([JSON.stringify({ hello: 'world' })], { type: 'application/json' });
const csv = new Blob([['hello', 'world'].join(',')], { type: 'text/csv' });

describe('file support', () => {
  test('create file with record', async () => {
    const record = await xata.db.users.create(
      { name: 'test', attachments: [XataFile.fromBlob(file)], photo: XataFile.fromBlob(file) },
      ['attachments.*', 'attachments.base64Content', 'photo.*', 'photo.base64Content']
    );

    expect(record.attachments?.[0]?.id).toBeDefined();
    expect(record.attachments?.[0]?.name).toBe('hello.txt');
    expect(record.attachments?.[0]?.base64Content).toBeDefined();
    expect(record.attachments?.[0]?.toBlob()).toBeInstanceOf(Blob);
    expect(record.attachments?.[0]?.toString()).toBe('hello');
    expect(record.attachments?.[0]?.mediaType).toBe('text/plain');

    expect(record.photo?.name).toBe('hello.txt');
    expect(record.photo?.base64Content).toBeDefined();
    expect(record.photo?.size).toBeGreaterThan(0);
    expect(record.photo?.toBlob()).toBeInstanceOf(Blob);
    expect(record.photo?.toString()).toBe('hello');
  });

  test('create file with binary endpoint JSON', async () => {
    const record = await xata.db.users.create({ name: 'another' });
    const file = await xata.files.upload({ table: 'users', column: 'attachments', record: record.id }, json);

    expect(file.id).toBeDefined();
    expect(file.mediaType).toBe('application/json');

    const query = await record.read(['attachments.*', 'attachments.base64Content']);

    expect(query?.attachments?.[0]?.mediaType).toBe('application/json');
    expect(query?.attachments?.[0]?.base64Content).toBeDefined();

    const attachment = query?.attachments?.[0]?.toBlob();

    expect(attachment).toBeInstanceOf(Blob);
    const content = await attachment?.text();
    expect(content).toBe('{"hello":"world"}');
  });

  test('create file with binary endpoint CSV', async () => {
    const record = await xata.db.users.create({ name: 'another' });
    const file = await xata.files.upload({ table: 'users', column: 'attachments', record: record.id }, csv);

    expect(file.id).toBeDefined();
    expect(file.mediaType).toBe('text/csv');

    const query = await record.read(['attachments.*', 'attachments.base64Content']);

    expect(query?.attachments?.[0]?.mediaType).toBe('text/csv');
    expect(query?.attachments?.[0]?.base64Content).toBeDefined();

    const attachment = query?.attachments?.[0]?.toBlob();

    expect(attachment).toBeInstanceOf(Blob);
    const content = await attachment?.text();
    expect(content).toBe('hello,world');
  });
});
