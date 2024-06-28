import { Kysely } from 'kysely';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient, DatabaseSchema } from '../../codegen/example/xata';
import { Model, XataDialect } from '../src';
import { TestEnvironmentResult, setUpTestEnvironment } from '../../../test/utils/setup';
import { XataFile } from '@xata.io/client';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];
let db: Kysely<Model<DatabaseSchema>>;

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('kysely');

  xata = result.client;
  hooks = result.hooks;
  db = new Kysely<Model<DatabaseSchema>>({ dialect: new XataDialect({ xata }) });

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

const file = new Blob(['hello'], { type: 'text/plain' });

describe('@xata.io/kysely plugin', () => {
  test('Select multiple columns', async () => {
    const user = await xata.db.users.create({ name: 'John Doe', attachments: [file] });

    const users = await db.selectFrom('users').select(['name', 'photo']).where('id', '=', user.id).execute();

    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('John Doe');
    expect(users[0].photo?.signedUrlTimeout).toBe(60);
  });
});
