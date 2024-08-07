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
  test.skip('Select multiple columns', async () => {
    const user = await xata.db.users.create({ name: 'John Doe', attachments: [file] });

    const users = await db.selectFrom('users').selectAll().where('xata_id', '=', user.xata_id).execute();

    expect(users).toHaveLength(1);
    expect(users[0].account_value).toBe(null);
    expect(users[0].attachments).toHaveLength(1);
    expect(users[0].attachments?.[0].enablePublicUrl).toBe(false);
    expect(users[0].attachments?.[0].xata_id).toBeDefined();
    expect(users[0].attachments?.[0].mediaType).toBe('application/octet-stream');
    expect(users[0].attachments?.[0].name).toBe('');
    expect(users[0].attachments?.[0].signedUrlTimeout).toBe(60);
    expect(users[0].attachments?.[0].size).toBe(0);
    expect(users[0].attachments?.[0].storageKey).toBeDefined();
    expect(users[0].attachments?.[0].uploadKey).toBeDefined();
    expect(users[0].attachments?.[0].uploadUrlTimeout).toBe(86400);
    expect(users[0].attachments?.[0].version).toBe(0);
    expect(users[0].birthDate).toBe(null);
    expect(users[0].dark).toBe(null);
    expect(users[0].email).toBe(null);
    expect(users[0].full_name).toBe('John Doe');
    expect(users[0].xata_id).toBeDefined();
    expect(users[0].index).toBe(null);
    expect(users[0].name).toBe('John Doe');
    expect(users[0].pet).toBe(null);
    expect(users[0].photo).toBeDefined();
    expect(users[0].photo?.signedUrlTimeout).toBe(60);
    expect(users[0].photo?.uploadKey).toBeDefined();
    expect(users[0].photo?.uploadUrlTimeout).toBe(86400);
    expect(users[0].plan).toBe(null);
    expect(users[0].rating).toBe(null);
    expect(users[0].street).toBe(null);
    expect(users[0].team).toBe(null);
    expect(users[0].vector).toBe(null);
    expect(users[0].xata).toBeDefined();
    expect(users[0].xata.createdAt).toBeDefined();
    expect(users[0].xata.updatedAt).toBeDefined();
    expect(users[0].xata.version).toBe(0);
    expect(users[0].zipcode).toBe(null);
  });

  test("Update record's column", async () => {
    const user = await xata.db.users.create({ name: 'John Doe' });

    await db.updateTable('users').set('name', 'Jane Doe').where('xata_id', '=', user.xata_id).execute();

    const users = await db.selectFrom('users').selectAll().where('xata_id', '=', user.xata_id).execute();

    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Jane Doe');
  });

  test('Update numeric column', async () => {
    const user = await xata.db.users.create({ account_value: 100 });

    await db.updateTable('users').set('account_value', 200).where('xata_id', '=', user.xata_id).execute();

    const users = await db.selectFrom('users').selectAll().where('xata_id', '=', user.xata_id).execute();

    expect(users).toHaveLength(1);
    expect(users[0].account_value).toBe(200);

    const incremented = await xata.db.users.update(user.xata_id, { account_value: { $increment: 100 } });

    expect(incremented?.account_value).toBe(300);

    const users2 = await db.selectFrom('users').selectAll().where('xata_id', '=', user.xata_id).execute();

    expect(users2).toHaveLength(1);
    expect(users2[0].account_value).toBe(300);
  });

  test("Select single columns with 'as' alias", async () => {
    const user = await xata.db.users.create({ name: 'John Doe' });

    const users = await db.selectFrom('users').select('name as name2').where('xata_id', '=', user.xata_id).execute();

    expect(users).toHaveLength(1);
    expect(users[0].name2).toBe('John Doe');
  });

  test('Select multiple column type', async () => {
    const team = await xata.db.teams.create({ name: 'Team A', labels: ['A', 'B'] });

    const teams = await db
      .selectFrom('teams')
      .select(['xata_id', 'labels'])
      .where('xata_id', '=', team.xata_id)
      .execute();

    expect(teams).toHaveLength(1);
    expect(teams[0].xata_id).toBeDefined();
    expect(teams[0].labels).toEqual(['A', 'B']);
  });
});
