import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../../packages/codegen/example/xata';
import { TestEnvironmentResult, setUpTestEnvironment } from '../../../test/utils/setup';
import { XataFile } from '../../../packages/client/src';
import { drizzle as drizzlePg, type XataDatabase } from '../src/pg';
import { drizzle as drizzleHttp, type XataHttpDatabase } from '../src/http';
import { Client } from 'pg';
import { pgTable, serial, text } from 'drizzle-orm/pg-core';
import { xataFileArray, xataFile } from '../src/types/files';
import { eq } from 'drizzle-orm';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];
let db: XataDatabase<any> | XataHttpDatabase<any>;
let pg: Client;

const file = new Blob(['hello'], { type: 'text/plain' });

const usersTable = pgTable('users', {
  xata_id: text('id').primaryKey(),
  name: text('name').notNull(),
  attachments: xataFileArray('attachments'),
  photo: xataFile('photo')
});

describe.concurrent.each([/**{ type: 'pg' }, **/ { type: 'http' }])('Drizzle $type file support', ({ type }) => {
  beforeAll(async (ctx) => {
    const result = await setUpTestEnvironment('files');

    xata = result.client;
    hooks = result.hooks;

    if (type === 'pg') {
      pg = new Client({ connectionString: xata.sql.connectionString });
      await pg.connect();
      db = drizzlePg(pg);
    } else {
      db = drizzleHttp(result.client);
    }

    return hooks.beforeAll(ctx);
  });

  afterAll(async (ctx) => {
    await pg?.end();
    await hooks.afterAll(ctx);
  });

  beforeEach(async (ctx) => {
    await hooks.beforeEach(ctx);
  });

  afterEach(async (ctx) => {
    await hooks.afterEach(ctx);
  });

  test('read file from record', async () => {
    const record = await xata.db.users.create(
      {
        name: 'test',
        attachments: [XataFile.fromBlob(file, { name: 'hello.txt' })],
        photo: XataFile.fromBlob(file, { name: 'hello.txt' })
      },
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

    // Check for default public access (photo is public by default, attachments are not)
    expect(record.attachments?.[0]?.enablePublicUrl).toBe(false);
    expect(record.photo?.enablePublicUrl).toBe(true);

    const result = await db.select().from(usersTable).where(eq(usersTable.xata_id, record.id)).execute();
    expect(result).toHaveLength(1);
    expect(result[0].attachments).toHaveLength(1);
    expect(result[0].photo).toBeDefined();

    expect(result[0].attachments?.[0].name).toBe('hello.txt');
    expect(result[0].attachments?.[0].mediaType).toBe('text/plain');
    expect(result[0].photo?.name).toBe('hello.txt');
    expect(result[0].photo?.mediaType).toBe('text/plain');
  });
});
