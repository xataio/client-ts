import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { File } from 'web-file-polyfill';
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

const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

describe('file support', () => {
  test('create file with record', async () => {
    const record = await xata.db.users.create(
      { name: 'test', attachments: [await XataFile.fromBlob(file)], photo: await XataFile.fromBlob(file) },
      ['attachments.base64Content', 'attachments.name', 'photo.base64Content', 'photo.name']
    );

    expect(record.attachments?.[0]?.name).toBe('hello.txt');
    expect(record.attachments?.[0]?.base64Content).toBeDefined();
    expect(record.attachments?.[0]?.toBlob()).toBeInstanceOf(Blob);
    expect(record.attachments?.[0]?.toString()).toBe('hello');

    expect(record.photo?.name).toBe('hello.txt');
    expect(record.photo?.base64Content).toBeDefined();
    expect(record.photo?.toBlob()).toBeInstanceOf(Blob);
    expect(record.photo?.toString()).toBe('hello');
  });
});
