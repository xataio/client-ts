import { BaseClient, HostProvider, parseProviderString, XataApiClient } from '@xata.io/client';
import 'dotenv/config';
import {
  and,
  arrayContained,
  arrayContains,
  arrayOverlaps,
  asc,
  avg,
  avgDistinct,
  count,
  countDistinct,
  eq,
  exists,
  gt,
  gte,
  inArray,
  lt,
  max,
  min,
  name,
  placeholder,
  sql,
  sum,
  sumDistinct,
  TransactionRollbackError,
  type SQL,
  type SQLWrapper
} from 'drizzle-orm';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import {
  alias,
  boolean,
  char,
  date,
  except,
  exceptAll,
  foreignKey,
  getMaterializedViewConfig,
  getTableConfig,
  getViewConfig,
  integer,
  intersect,
  intersectAll,
  interval,
  jsonb,
  numeric,
  pgEnum,
  pgMaterializedView,
  pgTable,
  pgTableCreator,
  uuid as pgUuid,
  pgView,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  union,
  unionAll,
  unique,
  uniqueKeyName,
  varchar,
  type PgColumn
} from 'drizzle-orm/pg-core';
import { Client } from 'pg';
import { v4 as uuid } from 'uuid';
import { afterAll, afterEach, assert, beforeAll, beforeEach, describe, test } from 'vitest';
import * as schema from './core.schema';
import { drizzle as drizzleHttp } from '../src/http';
import { migrate as migrateHttp } from '../src/http/migrator';
import path from 'path';

const {
  usersTable,
  cities2Table,
  users2Table,
  aggregateTable,
  orders,
  citiesTable,
  courseCategoriesTable,
  coursesTable,
  network,
  salEmp,
  usersMigratorTable
} = schema;

const notSupported = test.skip;
const fixme = test.skip;

const ENABLE_LOGGING = true;

declare module 'vitest' {
  export interface TestContext {
    db2: NodePgDatabase<typeof schema>; // | XataHttpDatabase<typeof schema>;
    client?: Client;
    branch: string;
    migrate: typeof migratePg; // | typeof migrateHttp;
  }
}

const apiKey = process.env.XATA_API_KEY ?? '';
if (apiKey === '') throw new Error('XATA_API_KEY environment variable is not set');

const workspace = (process.env.XATA_WORKSPACE ?? '').split('-').pop() ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const host = parseProviderString(process.env.XATA_API_PROVIDER) ?? 'production';

// TODO: Branches for pgroll only work in some regions for now
// const region = process.env.XATA_REGION || 'us-east-1';
const region =
  host === 'production' ? 'us-east-1' : host === 'staging' ? 'eu-west-1' : process.env.XATA_REGION || 'us-east-1';

const database = `drizzle-test-${Math.random().toString(36).substring(7)}`;

const api = new XataApiClient({ apiKey, host, clientName: 'sdk-tests' });

function getDomain(host: HostProvider) {
  switch (host) {
    case 'production':
      return 'xata.sh';
    case 'staging':
      return 'staging-xata.dev';
    case 'dev':
      return 'dev-xata.dev';
    case 'local':
      return 'localhost:6001';
    default:
      return host.workspaces;
  }
}

function getDrizzleClient(type: string, branch: string) {
  if (type === 'http') {
    const xata = new BaseClient({
      apiKey,
      host,
      clientName: 'sdk-tests',
      databaseURL: `https://${workspace}.${region}.${getDomain(host)}/db/${database}`,
      branch
    });

    return { db: drizzleHttp(xata, { schema, logger: ENABLE_LOGGING }) };
  } else if (type === 'pg') {
    const client = new Client({
      connectionString: `postgresql://${workspace}:${apiKey}@${region}.sql.${getDomain(
        host
      )}:5432/${database}:${branch}`,
      ssl: true
    });

    return { db: drizzlePg(client, { schema, logger: ENABLE_LOGGING }), client };
  } else {
    throw new Error(`Unknown type: ${type}`);
  }
}

async function setupSetOperationTest(db: NodePgDatabase<typeof schema>) {
  await db.execute(sql`drop table if exists users2`);
  await db.execute(sql`drop table if exists cities`);
  await db.execute(
    sql`
			create table cities (
				id serial primary key,
				name text not null
			)
		`
  );
  await db.execute(
    sql`
			create table users2 (
				id serial primary key,
				name text not null,
				city_id integer references cities(id)
			)
		`
  );

  await db.insert(cities2Table).values([
    { id: 1, name: 'New York' },
    { id: 2, name: 'London' },
    { id: 3, name: 'Tampa' }
  ]);

  await db.insert(users2Table).values([
    { id: 1, name: 'John', cityId: 1 },
    { id: 2, name: 'Jane', cityId: 2 },
    { id: 3, name: 'Jack', cityId: 3 },
    { id: 4, name: 'Peter', cityId: 3 },
    { id: 5, name: 'Ben', cityId: 2 },
    { id: 6, name: 'Jill', cityId: 1 },
    { id: 7, name: 'Mary', cityId: 2 },
    { id: 8, name: 'Sally', cityId: 1 }
  ]);
}

async function setupAggregateFunctionsTest(db: NodePgDatabase<typeof schema>) {
  await db.execute(sql`drop table if exists "aggregate_table"`);
  await db.execute(
    sql`
			create table "aggregate_table" (
				"id" serial not null,
				"name" text not null,
				"a" integer,
				"b" integer,
				"c" integer,
				"null_only" integer
			);
		`
  );
  await db.insert(aggregateTable).values([
    { name: 'value 1', a: 5, b: 10, c: 20 },
    { name: 'value 1', a: 5, b: 20, c: 30 },
    { name: 'value 2', a: 10, b: 50, c: 60 },
    { name: 'value 3', a: 20, b: 20, c: null },
    { name: 'value 4', a: null, b: 90, c: 120 },
    { name: 'value 5', a: 80, b: 10, c: null },
    { name: 'value 6', a: null, b: null, c: 150 }
  ]);
}

describe.concurrent.each([{ type: 'pg' }, { type: 'http' }])('Drizzle core $type', ({ type }) => {
  beforeAll(async () => {
    await api.database.createDatabase({
      workspace,
      database,
      data: { region, branchName: 'main' },
      headers: { 'X-Features': 'feat-pgroll-migrations=1' }
    });

    await waitForReplication();

    // For now, run the migrations via wire protocol
    const { client, db } = getDrizzleClient('pg', 'main');
    await client?.connect();

    await db.execute(sql`drop schema public cascade`);
    await db.execute(sql`create schema public`);
    await db.execute(
      sql`
			create table users (
				id serial primary key,
				name text not null,
				verified boolean not null default false, 
				jsonb jsonb,
				created_at timestamptz not null default now()
			)
		`
    );
    await db.execute(
      sql`
			create table cities (
				id serial primary key,
				name text not null,
				state char(2)
			)
		`
    );
    await db.execute(
      sql`
			create table users2 (
				id serial primary key,
				name text not null,
				city_id integer references cities(id)
			)
		`
    );
    await db.execute(
      sql`
			create table course_categories (
				id serial primary key,
				name text not null
			)
		`
    );
    await db.execute(
      sql`
			create table courses (
				id serial primary key,
				name text not null,
				category_id integer references course_categories(id)
			)
		`
    );
    await db.execute(
      sql`
			create table orders (
				id serial primary key,
				region text not null,
				product text not null,
				amount integer not null,
				quantity integer not null
			)
		`
    );
    await db.execute(
      sql`
			create table network_table (
				inet inet not null,
				cidr cidr not null,
				macaddr macaddr not null,
				macaddr8 macaddr8 not null
			)
		`
    );
    await db.execute(
      sql`
			create table sal_emp (
				name text not null,
				pay_by_quarter integer[] not null,
				schedule text[][] not null
			)
		`
    );
    await db.execute(
      sql`
			create table tictactoe (
				squares integer[3][3] not null
			)
		`
    );

    await client?.end();
  });

  afterAll(async () => {
    await api.database.deleteDatabase({ workspace, database });
  });

  beforeEach(async (ctx) => {
    ctx.branch = `test-${Math.random().toString(36).substring(7)}`;
    await api.branches.createBranch({ workspace, database, region, branch: ctx.branch, from: 'main' });

    const { db, client } = getDrizzleClient(type, ctx.branch);
    await client?.connect();

    // @ts-expect-error
    ctx.db2 = db;
    ctx.client = client;
    // @ts-expect-error
    ctx.migrate = type === 'pg' ? migratePg : migrateHttp;
  });

  afterEach(async (ctx) => {
    await ctx.client?.end();
    await api.branches.deleteBranch({ workspace, database, region, branch: ctx.branch });
  });

  /*
	[Find Many] One relation users+posts
*/

  test('table configs: unique third param', async (ctx) => {
    const cities1Table = pgTable(
      'cities1',
      {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        state: char('state', { length: 2 })
      },
      (t) => ({
        f: unique('custom_name').on(t.name, t.state).nullsNotDistinct(),
        f1: unique('custom_name1').on(t.name, t.state)
      })
    );

    const tableConfig = getTableConfig(cities1Table);

    ctx.expect(tableConfig.uniqueConstraints.length === 2);

    ctx.expect(tableConfig.uniqueConstraints[0]?.name === 'custom_name');
    ctx.expect(tableConfig.uniqueConstraints[0]?.nullsNotDistinct);
    assert.deepEqual(
      tableConfig.uniqueConstraints[0]?.columns.map((t) => t.name),
      ['name', 'state']
    );

    ctx.expect(tableConfig.uniqueConstraints[1]?.name, 'custom_name1');
    ctx.expect(!tableConfig.uniqueConstraints[1]?.nullsNotDistinct);
    assert.deepEqual(
      tableConfig.uniqueConstraints[0]?.columns.map((t) => t.name),
      ['name', 'state']
    );
  });

  test('table configs: unique in column', async (ctx) => {
    const cities1Table = pgTable('cities1', {
      id: serial('id').primaryKey(),
      name: text('name').notNull().unique(),
      state: char('state', { length: 2 }).unique('custom'),
      field: char('field', { length: 2 }).unique('custom_field', { nulls: 'not distinct' })
    });

    const tableConfig = getTableConfig(cities1Table);

    const columnName = tableConfig.columns.find((it) => it.name === 'name');
    ctx.expect(columnName?.uniqueName === uniqueKeyName(cities1Table, [columnName!.name]));
    ctx.expect(columnName?.isUnique);

    const columnState = tableConfig.columns.find((it) => it.name === 'state');
    ctx.expect(columnState?.uniqueName === 'custom');
    ctx.expect(columnState?.isUnique);

    const columnField = tableConfig.columns.find((it) => it.name === 'field');
    ctx.expect(columnField?.uniqueName === 'custom_field');
    ctx.expect(columnField?.isUnique);
    ctx.expect(columnField?.uniqueType === 'not distinct');
  });

  test('table config: foreign keys name', async (ctx) => {
    const table = pgTable(
      'cities',
      {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        state: text('state')
      },
      (t) => ({
        f: foreignKey({ foreignColumns: [t.id], columns: [t.id], name: 'custom_fk' })
      })
    );

    const tableConfig = getTableConfig(table);

    ctx.expect(tableConfig.foreignKeys.length === 1);
    ctx.expect(tableConfig.foreignKeys[0]!.getName() === 'custom_fk');
  });

  test('table config: primary keys name', async (ctx) => {
    const table = pgTable(
      'cities',
      {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        state: text('state')
      },
      (t) => ({
        f: primaryKey({ columns: [t.id, t.name], name: 'custom_pk' })
      })
    );

    const tableConfig = getTableConfig(table);

    ctx.expect(tableConfig.primaryKeys.length === 1);
    ctx.expect(tableConfig.primaryKeys[0]!.getName() === 'custom_pk');
  });

  test('select all fields', async (ctx) => {
    const { db2: db } = ctx;

    const now = Date.now();

    await db.insert(usersTable).values({ name: 'John' });
    const result = await db.select().from(usersTable);

    ctx.expect(result[0]!.createdAt instanceof Date);
    ctx.expect(Math.abs(result[0]!.createdAt.getTime() - now) < 100);
    assert.deepEqual(result, [{ id: 1, name: 'John', verified: false, jsonb: null, createdAt: result[0]!.createdAt }]);
  });

  test('select sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const users = await db
      .select({
        name: sql`upper(${usersTable.name})`
      })
      .from(usersTable);

    assert.deepEqual(users, [{ name: 'JOHN' }]);
  });

  test('select typed sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });

    const users = await db
      .select({
        name: sql<string>`upper(${usersTable.name})`
      })
      .from(usersTable);

    assert.deepEqual(users, [{ name: 'JOHN' }]);
  });

  test('$default function', async (ctx) => {
    const { db2: db } = ctx;

    const insertedOrder = await db
      .insert(orders)
      .values({ id: 1, region: 'Ukraine', amount: 1, quantity: 1 })
      .returning();
    const selectedOrder = await db.select().from(orders);

    assert.deepEqual(insertedOrder, [
      {
        id: 1,
        amount: 1,
        quantity: 1,
        region: 'Ukraine',
        product: 'random_string'
      }
    ]);

    assert.deepEqual(selectedOrder, [
      {
        id: 1,
        amount: 1,
        quantity: 1,
        region: 'Ukraine',
        product: 'random_string'
      }
    ]);
  });

  test('select distinct', async (ctx) => {
    const { db2: db } = ctx;

    const usersDistinctTable = pgTable('users_distinct', {
      id: integer('id').notNull(),
      name: text('name').notNull(),
      age: integer('age').notNull()
    });

    await db.execute(sql`drop table if exists ${usersDistinctTable}`);
    await db.execute(sql`create table ${usersDistinctTable} (id integer, name text, age integer)`);

    await db.insert(usersDistinctTable).values([
      { id: 1, name: 'John', age: 24 },
      { id: 1, name: 'John', age: 24 },
      { id: 2, name: 'John', age: 25 },
      { id: 1, name: 'Jane', age: 24 },
      { id: 1, name: 'Jane', age: 26 }
    ]);
    const users1 = await db
      .selectDistinct()
      .from(usersDistinctTable)
      .orderBy(usersDistinctTable.id, usersDistinctTable.name);
    const users2 = await db
      .selectDistinctOn([usersDistinctTable.id])
      .from(usersDistinctTable)
      .orderBy(usersDistinctTable.id);
    const users3 = await db
      .selectDistinctOn([usersDistinctTable.name], { name: usersDistinctTable.name })
      .from(usersDistinctTable)
      .orderBy(usersDistinctTable.name);
    const users4 = await db
      .selectDistinctOn([usersDistinctTable.id, usersDistinctTable.age])
      .from(usersDistinctTable)
      .orderBy(usersDistinctTable.id, usersDistinctTable.age);

    await db.execute(sql`drop table ${usersDistinctTable}`);

    assert.deepEqual(users1, [
      { id: 1, name: 'Jane', age: 24 },
      { id: 1, name: 'Jane', age: 26 },
      { id: 1, name: 'John', age: 24 },
      { id: 2, name: 'John', age: 25 }
    ]);

    assert.deepEqual(users2.length, 2);
    assert.deepEqual(users2[0]?.id, 1);
    assert.deepEqual(users2[1]?.id, 2);

    assert.deepEqual(users3.length, 2);
    assert.deepEqual(users3[0]?.name, 'Jane');
    assert.deepEqual(users3[1]?.name, 'John');

    assert.deepEqual(users4, [
      { id: 1, name: 'John', age: 24 },
      { id: 1, name: 'Jane', age: 26 },
      { id: 2, name: 'John', age: 25 }
    ]);
  });

  test('insert returning sql', async (ctx) => {
    const { db2: db } = ctx;

    const users = await db
      .insert(usersTable)
      .values({ name: 'John' })
      .returning({
        name: sql`upper(${usersTable.name})`
      });

    assert.deepEqual(users, [{ name: 'JOHN' }]);
  });

  test('delete returning sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const users = await db
      .delete(usersTable)
      .where(eq(usersTable.name, 'John'))
      .returning({
        name: sql`upper(${usersTable.name})`
      });

    assert.deepEqual(users, [{ name: 'JOHN' }]);
  });

  test('update returning sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const users = await db
      .update(usersTable)
      .set({ name: 'Jane' })
      .where(eq(usersTable.name, 'John'))
      .returning({
        name: sql`upper(${usersTable.name})`
      });

    assert.deepEqual(users, [{ name: 'JANE' }]);
  });

  test('update with returning all fields', async (ctx) => {
    const { db2: db } = ctx;

    const now = Date.now();

    await db.insert(usersTable).values({ name: 'John' });
    const users = await db.update(usersTable).set({ name: 'Jane' }).where(eq(usersTable.name, 'John')).returning();

    ctx.expect(users[0]!.createdAt instanceof Date);
    ctx.expect(Math.abs(users[0]!.createdAt.getTime() - now) < 100);
    assert.deepEqual(users, [{ id: 1, name: 'Jane', verified: false, jsonb: null, createdAt: users[0]!.createdAt }]);
  });

  test('update with returning partial', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const users = await db.update(usersTable).set({ name: 'Jane' }).where(eq(usersTable.name, 'John')).returning({
      id: usersTable.id,
      name: usersTable.name
    });

    assert.deepEqual(users, [{ id: 1, name: 'Jane' }]);
  });

  test('delete with returning all fields', async (ctx) => {
    const { db2: db } = ctx;

    const now = Date.now();

    await db.insert(usersTable).values({ name: 'John' });
    const users = await db.delete(usersTable).where(eq(usersTable.name, 'John')).returning();

    ctx.expect(users[0]!.createdAt instanceof Date);
    ctx.expect(Math.abs(users[0]!.createdAt.getTime() - now) < 100);
    assert.deepEqual(users, [{ id: 1, name: 'John', verified: false, jsonb: null, createdAt: users[0]!.createdAt }]);
  });

  test('delete with returning partial', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const users = await db.delete(usersTable).where(eq(usersTable.name, 'John')).returning({
      id: usersTable.id,
      name: usersTable.name
    });

    assert.deepEqual(users, [{ id: 1, name: 'John' }]);
  });

  test('insert + select', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const result = await db.select().from(usersTable);
    assert.deepEqual(result, [{ id: 1, name: 'John', verified: false, jsonb: null, createdAt: result[0]!.createdAt }]);

    await db.insert(usersTable).values({ name: 'Jane' });
    const result2 = await db.select().from(usersTable);
    assert.deepEqual(result2, [
      { id: 1, name: 'John', verified: false, jsonb: null, createdAt: result2[0]!.createdAt },
      { id: 2, name: 'Jane', verified: false, jsonb: null, createdAt: result2[1]!.createdAt }
    ]);
  });

  test('json insert', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John', jsonb: ['foo', 'bar'] });
    const result = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        jsonb: usersTable.jsonb
      })
      .from(usersTable);

    assert.deepEqual(result, [{ id: 1, name: 'John', jsonb: ['foo', 'bar'] }]);
  });

  test('char insert', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(citiesTable).values({ name: 'Austin', state: 'TX' });
    const result = await db
      .select({ id: citiesTable.id, name: citiesTable.name, state: citiesTable.state })
      .from(citiesTable);

    assert.deepEqual(result, [{ id: 1, name: 'Austin', state: 'TX' }]);
  });

  test('char update', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(citiesTable).values({ name: 'Austin', state: 'TX' });
    await db.update(citiesTable).set({ name: 'Atlanta', state: 'GA' }).where(eq(citiesTable.id, 1));
    const result = await db
      .select({ id: citiesTable.id, name: citiesTable.name, state: citiesTable.state })
      .from(citiesTable);

    assert.deepEqual(result, [{ id: 1, name: 'Atlanta', state: 'GA' }]);
  });

  test('char delete', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(citiesTable).values({ name: 'Austin', state: 'TX' });
    await db.delete(citiesTable).where(eq(citiesTable.state, 'TX'));
    const result = await db
      .select({ id: citiesTable.id, name: citiesTable.name, state: citiesTable.state })
      .from(citiesTable);

    assert.deepEqual(result, []);
  });

  test('insert with overridden default values', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John', verified: true });
    const result = await db.select().from(usersTable);

    assert.deepEqual(result, [{ id: 1, name: 'John', verified: true, jsonb: null, createdAt: result[0]!.createdAt }]);
  });

  test('insert many', async (ctx) => {
    const { db2: db } = ctx;

    await db
      .insert(usersTable)
      .values([
        { name: 'John' },
        { name: 'Bruce', jsonb: ['foo', 'bar'] },
        { name: 'Jane' },
        { name: 'Austin', verified: true }
      ]);
    const result = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        jsonb: usersTable.jsonb,
        verified: usersTable.verified
      })
      .from(usersTable);

    assert.deepEqual(result, [
      { id: 1, name: 'John', jsonb: null, verified: false },
      { id: 2, name: 'Bruce', jsonb: ['foo', 'bar'], verified: false },
      { id: 3, name: 'Jane', jsonb: null, verified: false },
      { id: 4, name: 'Austin', jsonb: null, verified: true }
    ]);
  });

  test('insert many with returning', async (ctx) => {
    const { db2: db } = ctx;

    const result = await db
      .insert(usersTable)
      .values([
        { name: 'John' },
        { name: 'Bruce', jsonb: ['foo', 'bar'] },
        { name: 'Jane' },
        { name: 'Austin', verified: true }
      ])
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        jsonb: usersTable.jsonb,
        verified: usersTable.verified
      });

    assert.deepEqual(result, [
      { id: 1, name: 'John', jsonb: null, verified: false },
      { id: 2, name: 'Bruce', jsonb: ['foo', 'bar'], verified: false },
      { id: 3, name: 'Jane', jsonb: null, verified: false },
      { id: 4, name: 'Austin', jsonb: null, verified: true }
    ]);
  });

  test('select with group by as field', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }, { name: 'Jane' }]);

    const result = await db.select({ name: usersTable.name }).from(usersTable).groupBy(usersTable.name);

    assert.deepEqual(result, [{ name: 'Jane' }, { name: 'John' }]);
  });

  test('select with exists', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }, { name: 'Jane' }]);

    const user = alias(usersTable, 'user');
    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(
        exists(
          db
            .select({ one: sql`1` })
            .from(user)
            .where(and(eq(usersTable.name, 'John'), eq(user.id, usersTable.id)))
        )
      );

    assert.deepEqual(result, [{ name: 'John' }]);
  });

  test('select with group by as sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }, { name: 'Jane' }]);

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(sql`${usersTable.name}`);

    assert.deepEqual(result, [{ name: 'Jane' }, { name: 'John' }]);
  });

  test('select with group by as sql + column', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }, { name: 'Jane' }]);

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(sql`${usersTable.name}`, usersTable.id);

    assert.deepEqual(result, [{ name: 'Jane' }, { name: 'Jane' }, { name: 'John' }]);
  });

  test('select with group by as column + sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }, { name: 'Jane' }]);

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(usersTable.id, sql`${usersTable.name}`);

    assert.deepEqual(result, [{ name: 'Jane' }, { name: 'Jane' }, { name: 'John' }]);
  });

  test('select with group by complex query', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }, { name: 'Jane' }]);

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(usersTable.id, sql`${usersTable.name}`)
      .orderBy(asc(usersTable.name))
      .limit(1);

    assert.deepEqual(result, [{ name: 'Jane' }]);
  });

  test('build query', async (ctx) => {
    const { db2: db } = ctx;

    const query = db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .groupBy(usersTable.id, usersTable.name)
      .toSQL();

    assert.deepEqual(query, {
      sql: 'select "id", "name" from "users" group by "users"."id", "users"."name"',
      params: []
    });
  });

  test('insert sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: sql`${'John'}` });
    const result = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    assert.deepEqual(result, [{ id: 1, name: 'John' }]);
  });

  test('partial join with alias', async (ctx) => {
    const { db2: db } = ctx;
    const customerAlias = alias(usersTable, 'customer');

    await db.insert(usersTable).values([
      { id: 10, name: 'Ivan' },
      { id: 11, name: 'Hans' }
    ]);
    const result = await db
      .select({
        user: {
          id: usersTable.id,
          name: usersTable.name
        },
        customer: {
          id: customerAlias.id,
          name: customerAlias.name
        }
      })
      .from(usersTable)
      .leftJoin(customerAlias, eq(customerAlias.id, 11))
      .where(eq(usersTable.id, 10));

    assert.deepEqual(result, [
      {
        user: { id: 10, name: 'Ivan' },
        customer: { id: 11, name: 'Hans' }
      }
    ]);
  });

  test('full join with alias', async (ctx) => {
    const { db2: db } = ctx;

    const pgTable = pgTableCreator((name) => `prefixed_${name}`);

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);
    await db.execute(sql`create table ${users} (id serial primary key, name text not null)`);

    const customers = alias(users, 'customer');

    await db.insert(users).values([
      { id: 10, name: 'Ivan' },
      { id: 11, name: 'Hans' }
    ]);
    const result = await db.select().from(users).leftJoin(customers, eq(customers.id, 11)).where(eq(users.id, 10));

    assert.deepEqual(result, [
      {
        users: {
          id: 10,
          name: 'Ivan'
        },
        customer: {
          id: 11,
          name: 'Hans'
        }
      }
    ]);

    await db.execute(sql`drop table ${users}`);
  });

  test('select from alias', async (ctx) => {
    const { db2: db } = ctx;

    const pgTable = pgTableCreator((name) => `prefixed_${name}`);

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);
    await db.execute(sql`create table ${users} (id serial primary key, name text not null)`);

    const user = alias(users, 'user');
    const customers = alias(users, 'customer');

    await db.insert(users).values([
      { id: 10, name: 'Ivan' },
      { id: 11, name: 'Hans' }
    ]);
    const result = await db.select().from(user).leftJoin(customers, eq(customers.id, 11)).where(eq(user.id, 10));

    assert.deepEqual(result, [
      {
        user: {
          id: 10,
          name: 'Ivan'
        },
        customer: {
          id: 11,
          name: 'Hans'
        }
      }
    ]);

    await db.execute(sql`drop table ${users}`);
  });

  test('insert with spaces', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: sql`'Jo   h     n'` });
    const result = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);

    assert.deepEqual(result, [{ id: 1, name: 'Jo   h     n' }]);
  });

  test('prepared statement', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const statement = db
      .select({
        id: usersTable.id,
        name: usersTable.name
      })
      .from(usersTable)
      .prepare('statement1');
    const result = await statement.execute();

    assert.deepEqual(result, [{ id: 1, name: 'John' }]);
  });

  test('prepared statement reuse', async (ctx) => {
    const { db2: db } = ctx;

    const stmt = db
      .insert(usersTable)
      .values({
        verified: true,
        name: placeholder('name')
      })
      .prepare('stmt2');

    for (let i = 0; i < 10; i++) {
      await stmt.execute({ name: `John ${i}` });
    }

    const result = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        verified: usersTable.verified
      })
      .from(usersTable);

    assert.deepEqual(result, [
      { id: 1, name: 'John 0', verified: true },
      { id: 2, name: 'John 1', verified: true },
      { id: 3, name: 'John 2', verified: true },
      { id: 4, name: 'John 3', verified: true },
      { id: 5, name: 'John 4', verified: true },
      { id: 6, name: 'John 5', verified: true },
      { id: 7, name: 'John 6', verified: true },
      { id: 8, name: 'John 7', verified: true },
      { id: 9, name: 'John 8', verified: true },
      { id: 10, name: 'John 9', verified: true }
    ]);
  });

  test('prepared statement with placeholder in .where', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const stmt = db
      .select({
        id: usersTable.id,
        name: usersTable.name
      })
      .from(usersTable)
      .where(eq(usersTable.id, placeholder('id')))
      .prepare('stmt3');
    const result = await stmt.execute({ id: 1 });

    assert.deepEqual(result, [{ id: 1, name: 'John' }]);
  });

  test('prepared statement with placeholder in .limit', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });
    const stmt = db
      .select({
        id: usersTable.id,
        name: usersTable.name
      })
      .from(usersTable)
      .where(eq(usersTable.id, placeholder('id')))
      .limit(placeholder('limit'))
      .prepare('stmt_limit');

    const result = await stmt.execute({ id: 1, limit: 1 });

    assert.deepEqual(result, [{ id: 1, name: 'John' }]);
    ctx.expect(result.length === 1);
  });

  test('prepared statement with placeholder in .offset', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'John1' }]);
    const stmt = db
      .select({
        id: usersTable.id,
        name: usersTable.name
      })
      .from(usersTable)
      .offset(placeholder('offset'))
      .prepare('stmt_offset');

    const result = await stmt.execute({ offset: 1 });

    assert.deepEqual(result, [{ id: 2, name: 'John1' }]);
  });

  // TODO change tests to new structure
  fixme('migrator : default migration strategy', async (ctx) => {
    const { db2: db } = ctx;

    await db.execute(sql`drop table if exists all_columns`);
    await db.execute(sql`drop table if exists users12`);
    await db.execute(sql`drop table if exists "drizzle"."__drizzle_migrations"`);

    await ctx.migrate(db, { migrationsFolder: path.join(__dirname, 'migrate') });

    await db.insert(usersMigratorTable).values({ name: 'John', email: 'email' });

    const result = await db.select().from(usersMigratorTable);

    assert.deepEqual(result, [{ id: 1, name: 'John', email: 'email' }]);

    await db.execute(sql`drop table all_columns`);
    await db.execute(sql`drop table users12`);
    await db.execute(sql`drop table "drizzle"."__drizzle_migrations"`);
  });

  fixme('migrator : migrate with custom schema', async (ctx) => {
    const { db2: db } = ctx;
    const customSchema = randomString();
    await db.execute(sql`drop table if exists all_columns`);
    await db.execute(sql`drop table if exists users12`);
    await db.execute(sql`drop table if exists "drizzle"."__drizzle_migrations"`);

    await ctx.migrate(db, { migrationsFolder: path.join(__dirname, 'migrate'), migrationsSchema: customSchema });

    // test if the custom migrations table was created
    const { rowCount } = await db.execute(sql`select * from ${sql.identifier(customSchema)}."__drizzle_migrations";`);
    ctx.expect(rowCount !== null && rowCount > 0);

    // test if the migrated table are working as expected
    await db.insert(usersMigratorTable).values({ name: 'John', email: 'email' });
    const result = await db.select().from(usersMigratorTable);
    assert.deepEqual(result, [{ id: 1, name: 'John', email: 'email' }]);

    await db.execute(sql`drop table all_columns`);
    await db.execute(sql`drop table users12`);
    await db.execute(sql`drop table ${sql.identifier(customSchema)}."__drizzle_migrations"`);
  });

  fixme('migrator : migrate with custom table', async (ctx) => {
    const { db2: db } = ctx;
    const customTable = randomString();
    await db.execute(sql`drop table if exists all_columns`);
    await db.execute(sql`drop table if exists users12`);
    await db.execute(sql`drop table if exists "drizzle"."__drizzle_migrations"`);

    await ctx.migrate(db, { migrationsFolder: path.join(__dirname, 'migrate'), migrationsTable: customTable });

    // test if the custom migrations table was created
    const { rowCount } = await db.execute(sql`select * from "drizzle".${sql.identifier(customTable)};`);
    ctx.expect(rowCount !== null && rowCount > 0);

    // test if the migrated table are working as expected
    await db.insert(usersMigratorTable).values({ name: 'John', email: 'email' });
    const result = await db.select().from(usersMigratorTable);
    assert.deepEqual(result, [{ id: 1, name: 'John', email: 'email' }]);

    await db.execute(sql`drop table all_columns`);
    await db.execute(sql`drop table users12`);
    await db.execute(sql`drop table "drizzle".${sql.identifier(customTable)}`);
  });

  fixme('migrator : migrate with custom table and custom schema', async (ctx) => {
    const { db2: db } = ctx;
    const customTable = randomString();
    const customSchema = randomString();
    await db.execute(sql`drop table if exists all_columns`);
    await db.execute(sql`drop table if exists users12`);
    await db.execute(sql`drop table if exists "drizzle"."__drizzle_migrations"`);

    await ctx.migrate(db, {
      migrationsFolder: path.join(__dirname, 'migrate'),
      migrationsTable: customTable,
      migrationsSchema: customSchema
    });

    // test if the custom migrations table was created
    const { rowCount } = await db.execute(
      sql`select * from ${sql.identifier(customSchema)}.${sql.identifier(customTable)};`
    );
    ctx.expect(rowCount !== null && rowCount > 0);

    // test if the migrated table are working as expected
    await db.insert(usersMigratorTable).values({ name: 'John', email: 'email' });
    const result = await db.select().from(usersMigratorTable);
    assert.deepEqual(result, [{ id: 1, name: 'John', email: 'email' }]);

    await db.execute(sql`drop table all_columns`);
    await db.execute(sql`drop table users12`);
    await db.execute(sql`drop table ${sql.identifier(customSchema)}.${sql.identifier(customTable)}`);
  });

  test('insert via db.execute + select via db.execute', async (ctx) => {
    const { db2: db } = ctx;

    await db.execute(sql`insert into ${usersTable} (${name(usersTable.name.name)}) values (${'John'})`);

    const result = await db.execute<{ id: number; name: string }>(sql`select id, name from "users"`);
    assert.deepEqual(result.rows, [{ id: 1, name: 'John' }]);
  });

  test('insert via db.execute + returning', async (ctx) => {
    const { db2: db } = ctx;

    const inserted = await db.execute<{ id: number; name: string }>(
      sql`insert into ${usersTable} (${name(usersTable.name.name)}) values (${'John'}) returning ${usersTable.id}, ${
        usersTable.name
      }`
    );
    assert.deepEqual(inserted.rows, [{ id: 1, name: 'John' }]);
  });

  test('insert via db.execute w/ query builder', async (ctx) => {
    const { db2: db } = ctx;

    const inserted = await db.execute<Pick<typeof usersTable.$inferSelect, 'id' | 'name'>>(
      db.insert(usersTable).values({ name: 'John' }).returning({ id: usersTable.id, name: usersTable.name })
    );
    assert.deepEqual(inserted.rows, [{ id: 1, name: 'John' }]);
  });

  test('Query check: Insert all defaults in 1 row', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').default('Dan'),
      state: text('state')
    });

    const query = db.insert(users).values({}).toSQL();

    assert.deepEqual(query, {
      sql: 'insert into "users" ("id", "name", "state") values (default, default, default)',
      params: []
    });
  });

  test('Query check: Insert all defaults in multiple rows', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').default('Dan'),
      state: text('state').default('UA')
    });

    const query = db.insert(users).values([{}, {}]).toSQL();

    assert.deepEqual(query, {
      sql: 'insert into "users" ("id", "name", "state") values (default, default, default), (default, default, default)',
      params: []
    });
  });

  test('Insert all defaults in 1 row', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('empty_insert_single', {
      id: serial('id').primaryKey(),
      name: text('name').default('Dan'),
      state: text('state')
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(sql`create table ${users} (id serial primary key, name text default 'Dan', state text)`);

    await db.insert(users).values({});

    const res = await db.select().from(users);

    assert.deepEqual(res, [{ id: 1, name: 'Dan', state: null }]);
  });

  test('Insert all defaults in multiple rows', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('empty_insert_multiple', {
      id: serial('id').primaryKey(),
      name: text('name').default('Dan'),
      state: text('state')
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(sql`create table ${users} (id serial primary key, name text default 'Dan', state text)`);

    await db.insert(users).values([{}, {}]);

    const res = await db.select().from(users);

    assert.deepEqual(res, [
      { id: 1, name: 'Dan', state: null },
      { id: 2, name: 'Dan', state: null }
    ]);
  });

  test('build query insert with onConflict do update', async (ctx) => {
    const { db2: db } = ctx;

    const query = db
      .insert(usersTable)
      .values({ name: 'John', jsonb: ['foo', 'bar'] })
      .onConflictDoUpdate({ target: usersTable.id, set: { name: 'John1' } })
      .toSQL();

    assert.deepEqual(query, {
      sql: 'insert into "users" ("id", "name", "verified", "jsonb", "created_at") values (default, $1, default, $2, default) on conflict ("id") do update set "name" = $3',
      params: ['John', '["foo","bar"]', 'John1']
    });
  });

  test('build query insert with onConflict do update / multiple columns', async (ctx) => {
    const { db2: db } = ctx;

    const query = db
      .insert(usersTable)
      .values({ name: 'John', jsonb: ['foo', 'bar'] })
      .onConflictDoUpdate({ target: [usersTable.id, usersTable.name], set: { name: 'John1' } })
      .toSQL();

    assert.deepEqual(query, {
      sql: 'insert into "users" ("id", "name", "verified", "jsonb", "created_at") values (default, $1, default, $2, default) on conflict ("id","name") do update set "name" = $3',
      params: ['John', '["foo","bar"]', 'John1']
    });
  });

  test('build query insert with onConflict do nothing', async (ctx) => {
    const { db2: db } = ctx;

    const query = db
      .insert(usersTable)
      .values({ name: 'John', jsonb: ['foo', 'bar'] })
      .onConflictDoNothing()
      .toSQL();

    assert.deepEqual(query, {
      sql: 'insert into "users" ("id", "name", "verified", "jsonb", "created_at") values (default, $1, default, $2, default) on conflict do nothing',
      params: ['John', '["foo","bar"]']
    });
  });

  test('build query insert with onConflict do nothing + target', async (ctx) => {
    const { db2: db } = ctx;

    const query = db
      .insert(usersTable)
      .values({ name: 'John', jsonb: ['foo', 'bar'] })
      .onConflictDoNothing({ target: usersTable.id })
      .toSQL();

    assert.deepEqual(query, {
      sql: 'insert into "users" ("id", "name", "verified", "jsonb", "created_at") values (default, $1, default, $2, default) on conflict ("id") do nothing',
      params: ['John', '["foo","bar"]']
    });
  });

  test('insert with onConflict do update', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });

    await db
      .insert(usersTable)
      .values({ id: 1, name: 'John' })
      .onConflictDoUpdate({ target: usersTable.id, set: { name: 'John1' } });

    const res = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, 1));

    assert.deepEqual(res, [{ id: 1, name: 'John1' }]);
  });

  test('insert with onConflict do nothing', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });

    await db.insert(usersTable).values({ id: 1, name: 'John' }).onConflictDoNothing();

    const res = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, 1));

    assert.deepEqual(res, [{ id: 1, name: 'John' }]);
  });

  test('insert with onConflict do nothing + target', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values({ name: 'John' });

    await db.insert(usersTable).values({ id: 1, name: 'John' }).onConflictDoNothing({ target: usersTable.id });

    const res = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, 1));

    assert.deepEqual(res, [{ id: 1, name: 'John' }]);
  });

  test('left join (flat object fields)', async (ctx) => {
    const { db2: db } = ctx;

    const { id: cityId } = await db
      .insert(citiesTable)
      .values([{ name: 'Paris' }, { name: 'London' }])
      .returning({ id: citiesTable.id })
      .then((rows) => rows[0]!);

    await db.insert(users2Table).values([{ name: 'John', cityId }, { name: 'Jane' }]);

    const res = await db
      .select({
        userId: users2Table.id,
        userName: users2Table.name,
        cityId: citiesTable.id,
        cityName: citiesTable.name
      })
      .from(users2Table)
      .leftJoin(citiesTable, eq(users2Table.cityId, citiesTable.id));

    assert.deepEqual(res, [
      { userId: 1, userName: 'John', cityId, cityName: 'Paris' },
      { userId: 2, userName: 'Jane', cityId: null, cityName: null }
    ]);
  });

  test('left join (grouped fields)', async (ctx) => {
    const { db2: db } = ctx;

    const { id: cityId } = await db
      .insert(citiesTable)
      .values([{ name: 'Paris' }, { name: 'London' }])
      .returning({ id: citiesTable.id })
      .then((rows) => rows[0]!);

    await db.insert(users2Table).values([{ name: 'John', cityId }, { name: 'Jane' }]);

    const res = await db
      .select({
        id: users2Table.id,
        user: {
          name: users2Table.name,
          nameUpper: sql<string>`upper(${users2Table.name})`
        },
        city: {
          id: citiesTable.id,
          name: citiesTable.name,
          nameUpper: sql<string>`upper(${citiesTable.name})`
        }
      })
      .from(users2Table)
      .leftJoin(citiesTable, eq(users2Table.cityId, citiesTable.id));

    assert.deepEqual(res, [
      {
        id: 1,
        user: { name: 'John', nameUpper: 'JOHN' },
        city: { id: cityId, name: 'Paris', nameUpper: 'PARIS' }
      },
      {
        id: 2,
        user: { name: 'Jane', nameUpper: 'JANE' },
        city: null
      }
    ]);
  });

  test('left join (all fields)', async (ctx) => {
    const { db2: db } = ctx;

    const { id: cityId } = await db
      .insert(citiesTable)
      .values([{ name: 'Paris' }, { name: 'London' }])
      .returning({ id: citiesTable.id })
      .then((rows) => rows[0]!);

    await db.insert(users2Table).values([{ name: 'John', cityId }, { name: 'Jane' }]);

    const res = await db.select().from(users2Table).leftJoin(citiesTable, eq(users2Table.cityId, citiesTable.id));

    assert.deepEqual(res, [
      {
        users2: {
          id: 1,
          name: 'John',
          cityId
        },
        cities: {
          id: cityId,
          name: 'Paris',
          state: null
        }
      },
      {
        users2: {
          id: 2,
          name: 'Jane',
          cityId: null
        },
        cities: null
      }
    ]);
  });

  test('join subquery', async (ctx) => {
    const { db2: db } = ctx;

    await db
      .insert(courseCategoriesTable)
      .values([{ name: 'Category 1' }, { name: 'Category 2' }, { name: 'Category 3' }, { name: 'Category 4' }]);

    await db.insert(coursesTable).values([
      { name: 'Development', categoryId: 2 },
      { name: 'IT & Software', categoryId: 3 },
      { name: 'Marketing', categoryId: 4 },
      { name: 'Design', categoryId: 1 }
    ]);

    const sq2 = db
      .select({
        categoryId: courseCategoriesTable.id,
        category: courseCategoriesTable.name,
        total: sql<number>`count(${courseCategoriesTable.id})`
      })
      .from(courseCategoriesTable)
      .groupBy(courseCategoriesTable.id, courseCategoriesTable.name)
      .as('sq2');

    const res = await db
      .select({
        courseName: coursesTable.name,
        categoryId: sq2.categoryId
      })
      .from(coursesTable)
      .leftJoin(sq2, eq(coursesTable.categoryId, sq2.categoryId))
      .orderBy(coursesTable.name);

    assert.deepEqual(res, [
      { courseName: 'Design', categoryId: 1 },
      { courseName: 'Development', categoryId: 2 },
      { courseName: 'IT & Software', categoryId: 3 },
      { courseName: 'Marketing', categoryId: 4 }
    ]);
  });

  test('with ... select', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(orders).values([
      { region: 'Europe', product: 'A', amount: 10, quantity: 1 },
      { region: 'Europe', product: 'A', amount: 20, quantity: 2 },
      { region: 'Europe', product: 'B', amount: 20, quantity: 2 },
      { region: 'Europe', product: 'B', amount: 30, quantity: 3 },
      { region: 'US', product: 'A', amount: 30, quantity: 3 },
      { region: 'US', product: 'A', amount: 40, quantity: 4 },
      { region: 'US', product: 'B', amount: 40, quantity: 4 },
      { region: 'US', product: 'B', amount: 50, quantity: 5 }
    ]);

    const regionalSales = db.$with('regional_sales').as(
      db
        .select({
          region: orders.region,
          totalSales: sql<number>`sum(${orders.amount})`.as('total_sales')
        })
        .from(orders)
        .groupBy(orders.region)
    );

    const topRegions = db.$with('top_regions').as(
      db
        .select({
          region: regionalSales.region
        })
        .from(regionalSales)
        .where(
          gt(
            regionalSales.totalSales,
            db.select({ sales: sql`sum(${regionalSales.totalSales})/10` }).from(regionalSales)
          )
        )
    );

    const result1 = await db
      .with(regionalSales, topRegions)
      .select({
        region: orders.region,
        product: orders.product,
        productUnits: sql<number>`sum(${orders.quantity})::int`,
        productSales: sql<number>`sum(${orders.amount})::int`
      })
      .from(orders)
      .where(inArray(orders.region, db.select({ region: topRegions.region }).from(topRegions)))
      .groupBy(orders.region, orders.product)
      .orderBy(orders.region, orders.product);
    const result2 = await db
      .with(regionalSales, topRegions)
      .selectDistinct({
        region: orders.region,
        product: orders.product,
        productUnits: sql<number>`sum(${orders.quantity})::int`,
        productSales: sql<number>`sum(${orders.amount})::int`
      })
      .from(orders)
      .where(inArray(orders.region, db.select({ region: topRegions.region }).from(topRegions)))
      .groupBy(orders.region, orders.product)
      .orderBy(orders.region, orders.product);
    const result3 = await db
      .with(regionalSales, topRegions)
      .selectDistinctOn([orders.region], {
        region: orders.region,
        productUnits: sql<number>`sum(${orders.quantity})::int`,
        productSales: sql<number>`sum(${orders.amount})::int`
      })
      .from(orders)
      .where(inArray(orders.region, db.select({ region: topRegions.region }).from(topRegions)))
      .groupBy(orders.region)
      .orderBy(orders.region);

    assert.deepEqual(result1, [
      {
        region: 'Europe',
        product: 'A',
        productUnits: 3,
        productSales: 30
      },
      {
        region: 'Europe',
        product: 'B',
        productUnits: 5,
        productSales: 50
      },
      {
        region: 'US',
        product: 'A',
        productUnits: 7,
        productSales: 70
      },
      {
        region: 'US',
        product: 'B',
        productUnits: 9,
        productSales: 90
      }
    ]);
    assert.deepEqual(result2, result1);
    assert.deepEqual(result3, [
      {
        region: 'Europe',
        productUnits: 8,
        productSales: 80
      },
      {
        region: 'US',
        productUnits: 16,
        productSales: 160
      }
    ]);
  });

  test('with ... update', async (ctx) => {
    const { db2: db } = ctx;

    const products = pgTable('products', {
      id: serial('id').primaryKey(),
      price: numeric('price').notNull(),
      cheap: boolean('cheap').notNull().default(false)
    });

    await db.execute(sql`drop table if exists ${products}`);
    await db.execute(sql`
		create table ${products} (
			id serial primary key,
			price numeric not null,
			cheap boolean not null default false
		)
	`);

    await db
      .insert(products)
      .values([{ price: '10.99' }, { price: '25.85' }, { price: '32.99' }, { price: '2.50' }, { price: '4.59' }]);

    const averagePrice = db.$with('average_price').as(
      db
        .select({
          value: sql`avg(${products.price})`.as('value')
        })
        .from(products)
    );

    const result = await db
      .with(averagePrice)
      .update(products)
      .set({
        cheap: true
      })
      .where(lt(products.price, sql`(select * from ${averagePrice})`))
      .returning({
        id: products.id
      });

    assert.deepEqual(result, [{ id: 1 }, { id: 4 }, { id: 5 }]);
  });

  test('with ... insert', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users', {
      username: text('username').notNull(),
      admin: boolean('admin').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);
    await db.execute(sql`create table ${users} (username text not null, admin boolean not null default false)`);

    const userCount = db.$with('user_count').as(
      db
        .select({
          value: sql`count(*)`.as('value')
        })
        .from(users)
    );

    const result = await db
      .with(userCount)
      .insert(users)
      .values([{ username: 'user1', admin: sql`((select * from ${userCount}) = 0)` }])
      .returning({
        admin: users.admin
      });

    assert.deepEqual(result, [{ admin: true }]);
  });

  test('with ... delete', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(orders).values([
      { region: 'Europe', product: 'A', amount: 10, quantity: 1 },
      { region: 'Europe', product: 'A', amount: 20, quantity: 2 },
      { region: 'Europe', product: 'B', amount: 20, quantity: 2 },
      { region: 'Europe', product: 'B', amount: 30, quantity: 3 },
      { region: 'US', product: 'A', amount: 30, quantity: 3 },
      { region: 'US', product: 'A', amount: 40, quantity: 4 },
      { region: 'US', product: 'B', amount: 40, quantity: 4 },
      { region: 'US', product: 'B', amount: 50, quantity: 5 }
    ]);

    const averageAmount = db.$with('average_amount').as(
      db
        .select({
          value: sql`avg(${orders.amount})`.as('value')
        })
        .from(orders)
    );

    const result = await db
      .with(averageAmount)
      .delete(orders)
      .where(gt(orders.amount, sql`(select * from ${averageAmount})`))
      .returning({
        id: orders.id
      });

    assert.deepEqual(result, [{ id: 6 }, { id: 7 }, { id: 8 }]);
  });

  test('select from subquery sql', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(users2Table).values([{ name: 'John' }, { name: 'Jane' }]);

    const sq = db
      .select({ name: sql<string>`${users2Table.name} || ' modified'`.as('name') })
      .from(users2Table)
      .as('sq');

    const res = await db.select({ name: sq.name }).from(sq);

    assert.deepEqual(res, [{ name: 'John modified' }, { name: 'Jane modified' }]);
  });

  test('select a field without joining its table', (ctx) => {
    const { db2: db } = ctx;

    ctx.expect(() => db.select({ name: users2Table.name }).from(usersTable).prepare('query')).toThrowError();
  });

  test('select all fields from subquery without alias', (ctx) => {
    const { db2: db } = ctx;

    const sq = db.$with('sq').as(db.select({ name: sql<string>`upper(${users2Table.name})` }).from(users2Table));

    ctx.expect(() => db.select().from(sq).prepare('query')).toThrowError();
  });

  test('select count()', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }]);

    const res = await db.select({ count: sql`count(*)` }).from(usersTable);

    assert.deepEqual(res, [{ count: '2' }]);
  });

  test('select count w/ custom mapper', async (ctx) => {
    const { db2: db } = ctx;

    function count(value: PgColumn | SQLWrapper): SQL<number>;
    function count(value: PgColumn | SQLWrapper, alias: string): SQL.Aliased<number>;
    function count(value: PgColumn | SQLWrapper, alias?: string): SQL<number> | SQL.Aliased<number> {
      const result = sql`count(${value})`.mapWith(Number);
      if (!alias) {
        return result;
      }
      return result.as(alias);
    }

    await db.insert(usersTable).values([{ name: 'John' }, { name: 'Jane' }]);

    const res = await db.select({ count: count(sql`*`) }).from(usersTable);

    assert.deepEqual(res, [{ count: 2 }]);
  });

  test('network types', async (ctx) => {
    const { db2: db } = ctx;

    const value: typeof network.$inferSelect = {
      inet: '127.0.0.1',
      cidr: '192.168.100.128/25',
      macaddr: '08:00:2b:01:02:03',
      macaddr8: '08:00:2b:01:02:03:04:05'
    };

    await db.insert(network).values(value);

    const res = await db.select().from(network);

    assert.deepEqual(res, [value]);
  });

  test('array types', async (ctx) => {
    const { db2: db } = ctx;

    const values: (typeof salEmp.$inferSelect)[] = [
      {
        name: 'John',
        payByQuarter: [10000, 10000, 10000, 10000],
        schedule: [
          ['meeting', 'lunch'],
          ['training', 'presentation']
        ]
      },
      {
        name: 'Carol',
        payByQuarter: [20000, 25000, 25000, 25000],
        schedule: [
          ['breakfast', 'consulting'],
          ['meeting', 'lunch']
        ]
      }
    ];

    await db.insert(salEmp).values(values);

    const res = await db.select().from(salEmp);

    assert.deepEqual(res, values);
  });

  test('select for ...', (ctx) => {
    const { db2: db } = ctx;

    {
      const query = db.select().from(users2Table).for('update').toSQL();

      ctx.expect(query.sql).toMatch(/ for update$/);
    }

    {
      const query = db
        .select()
        .from(users2Table)
        .for('update', { of: [users2Table, coursesTable] })
        .toSQL();

      ctx.expect(query.sql).toMatch(/ for update of "users2", "courses"$/);
    }

    {
      const query = db.select().from(users2Table).for('no key update', { of: users2Table }).toSQL();

      ctx.expect(query.sql).toMatch(/for no key update of "users2"$/);
    }

    {
      const query = db.select().from(users2Table).for('no key update', { of: users2Table, skipLocked: true }).toSQL();

      ctx.expect(query.sql).toMatch(/ for no key update of "users2" skip locked$/);
    }

    {
      const query = db.select().from(users2Table).for('share', { of: users2Table, noWait: true }).toSQL();

      ctx.expect(query.sql).toMatch(/for share of "users2" no wait$/);
    }
  });

  test('having', async (ctx) => {
    const { db2: db } = ctx;

    await db.insert(citiesTable).values([{ name: 'London' }, { name: 'Paris' }, { name: 'New York' }]);

    await db.insert(users2Table).values([
      { name: 'John', cityId: 1 },
      { name: 'Jane', cityId: 1 },
      {
        name: 'Jack',
        cityId: 2
      }
    ]);

    const result = await db
      .select({
        id: citiesTable.id,
        name: sql<string>`upper(${citiesTable.name})`.as('upper_name'),
        usersCount: sql<number>`count(${users2Table.id})::int`.as('users_count')
      })
      .from(citiesTable)
      .leftJoin(users2Table, eq(users2Table.cityId, citiesTable.id))
      .where(({ name }) => sql`length(${name}) >= 3`)
      .groupBy(citiesTable.id)
      .having(({ usersCount }) => sql`${usersCount} > 0`)
      .orderBy(({ name }) => name);

    assert.deepEqual(result, [
      {
        id: 1,
        name: 'LONDON',
        usersCount: 2
      },
      {
        id: 2,
        name: 'PARIS',
        usersCount: 1
      }
    ]);
  });

  notSupported('view', async (ctx) => {
    const { db2: db } = ctx;

    const newYorkers1 = pgView('new_yorkers').as((qb) =>
      qb.select().from(users2Table).where(eq(users2Table.cityId, 1))
    );

    const newYorkers2 = pgView('new_yorkers', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      cityId: integer('city_id').notNull()
    }).as(sql`select * from ${users2Table} where ${eq(users2Table.cityId, 1)}`);

    const newYorkers3 = pgView('new_yorkers', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      cityId: integer('city_id').notNull()
    }).existing();

    await db.execute(sql`create view ${newYorkers1} as ${getViewConfig(newYorkers1).query}`);

    await db.insert(citiesTable).values([{ name: 'New York' }, { name: 'Paris' }]);

    await db.insert(users2Table).values([
      { name: 'John', cityId: 1 },
      { name: 'Jane', cityId: 1 },
      { name: 'Jack', cityId: 2 }
    ]);

    {
      const result = await db.select().from(newYorkers1);
      assert.deepEqual(result, [
        { id: 1, name: 'John', cityId: 1 },
        { id: 2, name: 'Jane', cityId: 1 }
      ]);
    }

    {
      const result = await db.select().from(newYorkers2);
      assert.deepEqual(result, [
        { id: 1, name: 'John', cityId: 1 },
        { id: 2, name: 'Jane', cityId: 1 }
      ]);
    }

    {
      const result = await db.select().from(newYorkers3);
      assert.deepEqual(result, [
        { id: 1, name: 'John', cityId: 1 },
        { id: 2, name: 'Jane', cityId: 1 }
      ]);
    }

    {
      const result = await db.select({ name: newYorkers1.name }).from(newYorkers1);
      assert.deepEqual(result, [{ name: 'John' }, { name: 'Jane' }]);
    }

    await db.execute(sql`drop view ${newYorkers1}`);
  });

  notSupported('materialized view', async (ctx) => {
    const { db2: db } = ctx;

    const newYorkers1 = pgMaterializedView('new_yorkers').as((qb) =>
      qb.select().from(users2Table).where(eq(users2Table.cityId, 1))
    );

    const newYorkers2 = pgMaterializedView('new_yorkers', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      cityId: integer('city_id').notNull()
    }).as(sql`select * from ${users2Table} where ${eq(users2Table.cityId, 1)}`);

    const newYorkers3 = pgMaterializedView('new_yorkers', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      cityId: integer('city_id').notNull()
    }).existing();

    await db.execute(sql`create materialized view ${newYorkers1} as ${getMaterializedViewConfig(newYorkers1).query}`);

    await db.insert(citiesTable).values([{ name: 'New York' }, { name: 'Paris' }]);

    await db.insert(users2Table).values([
      { name: 'John', cityId: 1 },
      { name: 'Jane', cityId: 1 },
      { name: 'Jack', cityId: 2 }
    ]);

    {
      const result = await db.select().from(newYorkers1);
      assert.deepEqual(result, []);
    }

    await db.refreshMaterializedView(newYorkers1);

    {
      const result = await db.select().from(newYorkers1);
      assert.deepEqual(result, [
        { id: 1, name: 'John', cityId: 1 },
        { id: 2, name: 'Jane', cityId: 1 }
      ]);
    }

    {
      const result = await db.select().from(newYorkers2);
      assert.deepEqual(result, [
        { id: 1, name: 'John', cityId: 1 },
        { id: 2, name: 'Jane', cityId: 1 }
      ]);
    }

    {
      const result = await db.select().from(newYorkers3);
      assert.deepEqual(result, [
        { id: 1, name: 'John', cityId: 1 },
        { id: 2, name: 'Jane', cityId: 1 }
      ]);
    }

    {
      const result = await db.select({ name: newYorkers1.name }).from(newYorkers1);
      assert.deepEqual(result, [{ name: 'John' }, { name: 'Jane' }]);
    }

    await db.execute(sql`drop materialized view ${newYorkers1}`);
  });

  // TODO: copy to SQLite and MySQL, add to docs
  test('select from raw sql', async (ctx) => {
    const { db2: db } = ctx;

    const result = await db
      .select({
        id: sql<number>`id`,
        name: sql<string>`name`
      })
      .from(sql`(select 1 as id, 'John' as name) as users`);

    Expect<Equal<{ id: number; name: string }[], typeof result>>;

    assert.deepEqual(result, [{ id: 1, name: 'John' }]);
  });

  test('select from raw sql with joins', async (ctx) => {
    const { db2: db } = ctx;

    const result = await db
      .select({
        id: sql<number>`users.id`,
        name: sql<string>`users.name`,
        userCity: sql<string>`users.city`,
        cityName: sql<string>`cities.name`
      })
      .from(sql`(select 1 as id, 'John' as name, 'New York' as city) as users`)
      .leftJoin(sql`(select 1 as id, 'Paris' as name) as cities`, sql`cities.id = users.id`);

    Expect<Equal<{ id: number; name: string; userCity: string; cityName: string }[], typeof result>>;

    assert.deepEqual(result, [{ id: 1, name: 'John', userCity: 'New York', cityName: 'Paris' }]);
  });

  test('join on aliased sql from select', async (ctx) => {
    const { db2: db } = ctx;

    const result = await db
      .select({
        userId: sql<number>`users.id`.as('userId'),
        name: sql<string>`users.name`,
        userCity: sql<string>`users.city`,
        cityId: sql<number>`cities.id`.as('cityId'),
        cityName: sql<string>`cities.name`
      })
      .from(sql`(select 1 as id, 'John' as name, 'New York' as city) as users`)
      .leftJoin(sql`(select 1 as id, 'Paris' as name) as cities`, (cols) => eq(cols.cityId, cols.userId));

    Expect<
      Equal<{ userId: number; name: string; userCity: string; cityId: number; cityName: string }[], typeof result>
    >;

    assert.deepEqual(result, [{ userId: 1, name: 'John', userCity: 'New York', cityId: 1, cityName: 'Paris' }]);
  });

  test('join on aliased sql from with clause', async (ctx) => {
    const { db2: db } = ctx;

    const users = db.$with('users').as(
      db
        .select({
          id: sql<number>`id`.as('userId'),
          name: sql<string>`name`.as('userName'),
          city: sql<string>`city`.as('city')
        })
        .from(sql`(select 1 as id, 'John' as name, 'New York' as city) as users`)
    );

    const cities = db.$with('cities').as(
      db
        .select({
          id: sql<number>`id`.as('cityId'),
          name: sql<string>`name`.as('cityName')
        })
        .from(sql`(select 1 as id, 'Paris' as name) as cities`)
    );

    const result = await db
      .with(users, cities)
      .select({
        userId: users.id,
        name: users.name,
        userCity: users.city,
        cityId: cities.id,
        cityName: cities.name
      })
      .from(users)
      .leftJoin(cities, (cols) => eq(cols.cityId, cols.userId));

    Expect<
      Equal<{ userId: number; name: string; userCity: string; cityId: number; cityName: string }[], typeof result>
    >;

    assert.deepEqual(result, [{ userId: 1, name: 'John', userCity: 'New York', cityId: 1, cityName: 'Paris' }]);
  });

  test('prefixed table', async (ctx) => {
    const { db2: db } = ctx;

    const pgTable = pgTableCreator((name) => `myprefix_${name}`);

    const users = pgTable('test_prefixed_table_with_unique_name', {
      id: integer('id').primaryKey(),
      name: text('name').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(
      sql`create table myprefix_test_prefixed_table_with_unique_name (id integer not null primary key, name text not null)`
    );

    await db.insert(users).values({ id: 1, name: 'John' });

    const result = await db.select().from(users);

    assert.deepEqual(result, [{ id: 1, name: 'John' }]);

    await db.execute(sql`drop table ${users}`);
  });

  notSupported('select from enum', async (ctx) => {
    const { db2: db } = ctx;

    const muscleEnum = pgEnum('muscle', [
      'abdominals',
      'hamstrings',
      'adductors',
      'quadriceps',
      'biceps',
      'shoulders',
      'chest',
      'middle_back',
      'calves',
      'glutes',
      'lower_back',
      'lats',
      'triceps',
      'traps',
      'forearms',
      'neck',
      'abductors'
    ]);

    const forceEnum = pgEnum('force', ['isometric', 'isotonic', 'isokinetic']);

    const levelEnum = pgEnum('level', ['beginner', 'intermediate', 'advanced']);

    const mechanicEnum = pgEnum('mechanic', ['compound', 'isolation']);

    const equipmentEnum = pgEnum('equipment', ['barbell', 'dumbbell', 'bodyweight', 'machine', 'cable', 'kettlebell']);

    const categoryEnum = pgEnum('category', ['upper_body', 'lower_body', 'full_body']);

    const exercises = pgTable('exercises', {
      id: serial('id').primaryKey(),
      name: varchar('name').notNull(),
      force: forceEnum('force'),
      level: levelEnum('level'),
      mechanic: mechanicEnum('mechanic'),
      equipment: equipmentEnum('equipment'),
      instructions: text('instructions'),
      category: categoryEnum('category'),
      primaryMuscles: muscleEnum('primary_muscles').array(),
      secondaryMuscles: muscleEnum('secondary_muscles').array(),
      createdAt: timestamp('created_at')
        .notNull()
        .default(sql`now()`),
      updatedAt: timestamp('updated_at')
        .notNull()
        .default(sql`now()`)
    });

    await db.execute(sql`drop table if exists ${exercises}`);
    await db.execute(sql`drop type if exists ${name(muscleEnum.enumName)}`);
    await db.execute(sql`drop type if exists ${name(forceEnum.enumName)}`);
    await db.execute(sql`drop type if exists ${name(levelEnum.enumName)}`);
    await db.execute(sql`drop type if exists ${name(mechanicEnum.enumName)}`);
    await db.execute(sql`drop type if exists ${name(equipmentEnum.enumName)}`);
    await db.execute(sql`drop type if exists ${name(categoryEnum.enumName)}`);

    await db.execute(
      sql`create type ${name(
        muscleEnum.enumName
      )} as enum ('abdominals', 'hamstrings', 'adductors', 'quadriceps', 'biceps', 'shoulders', 'chest', 'middle_back', 'calves', 'glutes', 'lower_back', 'lats', 'triceps', 'traps', 'forearms', 'neck', 'abductors')`
    );
    await db.execute(sql`create type ${name(forceEnum.enumName)} as enum ('isometric', 'isotonic', 'isokinetic')`);
    await db.execute(sql`create type ${name(levelEnum.enumName)} as enum ('beginner', 'intermediate', 'advanced')`);
    await db.execute(sql`create type ${name(mechanicEnum.enumName)} as enum ('compound', 'isolation')`);
    await db.execute(
      sql`create type ${name(
        equipmentEnum.enumName
      )} as enum ('barbell', 'dumbbell', 'bodyweight', 'machine', 'cable', 'kettlebell')`
    );
    await db.execute(sql`create type ${name(categoryEnum.enumName)} as enum ('upper_body', 'lower_body', 'full_body')`);
    await db.execute(sql`
		create table ${exercises} (
			id serial primary key,
			name varchar not null,
			force force,
			level level,
			mechanic mechanic,
			equipment equipment,
			instructions text,
			category category,
			primary_muscles muscle[],
			secondary_muscles muscle[],
			created_at timestamp not null default now(),
			updated_at timestamp not null default now()
		)
	`);

    await db.insert(exercises).values({
      name: 'Bench Press',
      force: 'isotonic',
      level: 'beginner',
      mechanic: 'compound',
      equipment: 'barbell',
      instructions:
        'Lie on your back on a flat bench. Grasp the barbell with an overhand grip, slightly wider than shoulder width. Unrack the barbell and hold it over you with your arms locked. Lower the barbell to your chest. Press the barbell back to the starting position.',
      category: 'upper_body',
      primaryMuscles: ['chest', 'triceps'],
      secondaryMuscles: ['shoulders', 'traps']
    });

    const result = await db.select().from(exercises);

    assert.deepEqual(result, [
      {
        id: 1,
        name: 'Bench Press',
        force: 'isotonic',
        level: 'beginner',
        mechanic: 'compound',
        equipment: 'barbell',
        instructions:
          'Lie on your back on a flat bench. Grasp the barbell with an overhand grip, slightly wider than shoulder width. Unrack the barbell and hold it over you with your arms locked. Lower the barbell to your chest. Press the barbell back to the starting position.',
        category: 'upper_body',
        primaryMuscles: ['chest', 'triceps'],
        secondaryMuscles: ['shoulders', 'traps'],
        createdAt: result[0]!.createdAt,
        updatedAt: result[0]!.updatedAt
      }
    ]);

    await db.execute(sql`drop table ${exercises}`);
    await db.execute(sql`drop type ${name(muscleEnum.enumName)}`);
    await db.execute(sql`drop type ${name(forceEnum.enumName)}`);
    await db.execute(sql`drop type ${name(levelEnum.enumName)}`);
    await db.execute(sql`drop type ${name(mechanicEnum.enumName)}`);
    await db.execute(sql`drop type ${name(equipmentEnum.enumName)}`);
    await db.execute(sql`drop type ${name(categoryEnum.enumName)}`);
  });

  test('all date and time columns', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      dateString: date('date_string', { mode: 'string' }).notNull(),
      time: time('time', { precision: 3 }).notNull(),
      datetime: timestamp('datetime').notNull(),
      datetimeWTZ: timestamp('datetime_wtz', { withTimezone: true }).notNull(),
      datetimeString: timestamp('datetime_string', { mode: 'string' }).notNull(),
      datetimeFullPrecision: timestamp('datetime_full_precision', { precision: 6, mode: 'string' }).notNull(),
      datetimeWTZString: timestamp('datetime_wtz_string', { withTimezone: true, mode: 'string' }).notNull(),
      interval: interval('interval').notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					date_string date not null,
					time time(3) not null,
					datetime timestamp not null,
					datetime_wtz timestamp with time zone not null,
					datetime_string timestamp not null,
					datetime_full_precision timestamp(6) not null,
					datetime_wtz_string timestamp with time zone not null,
					interval interval not null
			)
	`);

    const someDatetime = new Date('2022-01-01T00:00:00.123Z');
    const fullPrecision = '2022-01-01T00:00:00.123456Z';
    const someTime = '23:23:12.432';

    await db.insert(table).values({
      dateString: '2022-01-01',
      time: someTime,
      datetime: someDatetime,
      datetimeWTZ: someDatetime,
      datetimeString: '2022-01-01T00:00:00.123Z',
      datetimeFullPrecision: fullPrecision,
      datetimeWTZString: '2022-01-01T00:00:00.123Z',
      interval: '1 day'
    });

    const result = await db.select().from(table);

    Expect<
      Equal<
        {
          id: number;
          dateString: string;
          time: string;
          datetime: Date;
          datetimeWTZ: Date;
          datetimeString: string;
          datetimeFullPrecision: string;
          datetimeWTZString: string;
          interval: string;
        }[],
        typeof result
      >
    >;

    Expect<
      Equal<
        {
          dateString: string;
          time: string;
          datetime: Date;
          datetimeWTZ: Date;
          datetimeString: string;
          datetimeFullPrecision: string;
          datetimeWTZString: string;
          interval: string;
          id?: number | undefined;
        },
        typeof table.$inferInsert
      >
    >;

    assert.deepEqual(result, [
      {
        id: 1,
        dateString: '2022-01-01',
        time: someTime,
        datetime: someDatetime,
        datetimeWTZ: someDatetime,
        datetimeString: '2022-01-01 00:00:00.123',
        datetimeFullPrecision: fullPrecision.replace('T', ' ').replace('Z', ''),
        datetimeWTZString: '2022-01-01 00:00:00.123+00',
        interval: '1 day'
      }
    ]);

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('all date and time columns with timezone second case mode date', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'date', withTimezone: true, precision: 3 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(3) with time zone not null
			)
	`);

    const insertedDate = new Date();

    // 1. Insert date as new date
    await db.insert(table).values([{ timestamp: insertedDate }]);

    // 2, Select as date and check that timezones are the same
    // There is no way to check timezone in Date object, as it is always represented internally in UTC
    const result = await db.select().from(table);

    assert.deepEqual(result, [{ id: 1, timestamp: insertedDate }]);

    // 3. Compare both dates
    assert.deepEqual(insertedDate.getTime(), result[0]?.timestamp.getTime());

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('all date and time columns with timezone third case mode date', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'date', withTimezone: true, precision: 3 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(3) with time zone not null
			)
	`);

    const insertedDate = new Date('2022-01-01 20:00:00.123-04'); // used different time zones, internally is still UTC
    const insertedDate2 = new Date('2022-01-02 04:00:00.123+04'); // They are both the same date in different time zones

    // 1. Insert date as new dates with different time zones
    await db.insert(table).values([{ timestamp: insertedDate }, { timestamp: insertedDate2 }]);

    // 2, Select and compare both dates
    const result = await db.select().from(table);

    assert.deepEqual(result[0]?.timestamp.getTime(), result[1]?.timestamp.getTime());

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('all date and time columns without timezone first case mode string', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'string', precision: 6 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(6) not null
			)
	`);

    // 1. Insert date in string format without timezone in it
    await db.insert(table).values([{ timestamp: '2022-01-01 02:00:00.123456' }]);

    // 2, Select in string format and check that values are the same
    const result = await db.select().from(table);

    assert.deepEqual(result, [{ id: 1, timestamp: '2022-01-01 02:00:00.123456' }]);

    // 3. Select as raw query and check that values are the same
    const result2 = await db.execute<{
      id: number;
      timestamp_string: string;
    }>(sql`select * from ${table}`);

    assert.deepEqual(result2.rows, [{ id: 1, timestamp_string: '2022-01-01 02:00:00.123456' }]);

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('all date and time columns without timezone second case mode string', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'string', precision: 6 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(6) not null
			)
	`);

    // 1. Insert date in string format with timezone in it
    await db.insert(table).values([{ timestamp: '2022-01-01T02:00:00.123456-02' }]);

    // 2, Select as raw query and check that values are the same
    const result = await db.execute<{
      id: number;
      timestamp_string: string;
    }>(sql`select * from ${table}`);

    assert.deepEqual(result.rows, [{ id: 1, timestamp_string: '2022-01-01 02:00:00.123456' }]);

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('all date and time columns without timezone third case mode date', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'date', precision: 3 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(3) not null
			)
	`);

    const insertedDate = new Date('2022-01-01 20:00:00.123+04');

    // 1. Insert date as new date
    await db.insert(table).values([{ timestamp: insertedDate }]);

    // 2, Select as raw query as string
    const result = await db.execute<{
      id: number;
      timestamp_string: string;
    }>(sql`select * from ${table}`);

    // 3. Compare both dates using orm mapping - Need to add 'Z' to tell JS that it is UTC
    assert.deepEqual(new Date(result.rows[0]!.timestamp_string + 'Z').getTime(), insertedDate.getTime());

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('test mode string for timestamp with timezone', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'string', withTimezone: true, precision: 6 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(6) with time zone not null
			)
	`);

    const timestampString = '2022-01-01 00:00:00.123456-0200';

    // 1. Insert date in string format with timezone in it
    await db.insert(table).values([{ timestamp: timestampString }]);

    // 2. Select date in string format and check that the values are the same
    const result = await db.select().from(table);

    // 2.1 Notice that postgres will return the date in UTC, but it is exactly the same
    assert.deepEqual(result, [{ id: 1, timestamp: '2022-01-01 02:00:00.123456+00' }]);

    // 3. Select as raw query and checke that values are the same
    const result2 = await db.execute<{
      id: number;
      timestamp_string: string;
    }>(sql`select * from ${table}`);

    // 3.1 Notice that postgres will return the date in UTC, but it is exactlt the same
    assert.deepEqual(result2.rows, [{ id: 1, timestamp_string: '2022-01-01 02:00:00.123456+00' }]);

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('test mode date for timestamp with timezone', async (ctx) => {
    const { db2: db } = ctx;

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'date', withTimezone: true, precision: 3 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(3) with time zone not null
			)
	`);

    const timestampString = new Date('2022-01-01 00:00:00.456-0200');

    // 1. Insert date in string format with timezone in it
    await db.insert(table).values([{ timestamp: timestampString }]);

    // 2. Select date in string format and check that the values are the same
    const result = await db.select().from(table);

    // 2.1 Notice that postgres will return the date in UTC, but it is exactly the same
    assert.deepEqual(result, [{ id: 1, timestamp: timestampString }]);

    // 3. Select as raw query and checke that values are the same
    const result2 = await db.execute<{
      id: number;
      timestamp_string: string;
    }>(sql`select * from ${table}`);

    // 3.1 Notice that postgres will return the date in UTC, but it is exactlt the same
    assert.deepEqual(result2.rows, [{ id: 1, timestamp_string: '2022-01-01 02:00:00.456+00' }]);

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('test mode string for timestamp with timezone in UTC timezone', async (ctx) => {
    const { db2: db } = ctx;

    // get current timezone from db
    const timezone = await db.execute<{ TimeZone: string }>(sql`show timezone`);

    // set timezone to UTC
    await db.execute(sql`set time zone 'UTC'`);

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'string', withTimezone: true, precision: 6 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(6) with time zone not null
			)
	`);

    const timestampString = '2022-01-01 00:00:00.123456-0200';

    // 1. Insert date in string format with timezone in it
    await db.insert(table).values([{ timestamp: timestampString }]);

    // 2. Select date in string format and check that the values are the same
    const result = await db.select().from(table);

    // 2.1 Notice that postgres will return the date in UTC, but it is exactly the same
    assert.deepEqual(result, [{ id: 1, timestamp: '2022-01-01 02:00:00.123456+00' }]);

    // 3. Select as raw query and checke that values are the same
    const result2 = await db.execute<{
      id: number;
      timestamp_string: string;
    }>(sql`select * from ${table}`);

    // 3.1 Notice that postgres will return the date in UTC, but it is exactlt the same
    assert.deepEqual(result2.rows, [{ id: 1, timestamp_string: '2022-01-01 02:00:00.123456+00' }]);

    await db.execute(sql`set time zone '${sql.raw(timezone.rows[0]!.TimeZone)}'`);

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('test mode string for timestamp with timezone in different timezone', async (ctx) => {
    const { db2: db } = ctx;

    // get current timezone from db
    const timezone = await db.execute<{ TimeZone: string }>(sql`show timezone`);

    // set timezone to HST (UTC - 10)
    await db.execute(sql`set time zone 'HST'`);

    const table = pgTable('all_columns', {
      id: serial('id').primaryKey(),
      timestamp: timestamp('timestamp_string', { mode: 'string', withTimezone: true, precision: 6 }).notNull()
    });

    await db.execute(sql`drop table if exists ${table}`);

    await db.execute(sql`
		create table ${table} (
					id serial primary key,
					timestamp_string timestamp(6) with time zone not null
			)
	`);

    const timestampString = '2022-01-01 00:00:00.123456-1000';

    // 1. Insert date in string format with timezone in it
    await db.insert(table).values([{ timestamp: timestampString }]);

    // 2. Select date in string format and check that the values are the same
    const result = await db.select().from(table);

    assert.deepEqual(result, [{ id: 1, timestamp: '2022-01-01 00:00:00.123456-10' }]);

    // 3. Select as raw query and checke that values are the same
    const result2 = await db.execute<{
      id: number;
      timestamp_string: string;
    }>(sql`select * from ${table}`);

    assert.deepEqual(result2.rows, [{ id: 1, timestamp_string: '2022-01-01 00:00:00.123456-10' }]);

    await db.execute(sql`set time zone '${sql.raw(timezone.rows[0]!.TimeZone)}'`);

    await db.execute(sql`drop table if exists ${table}`);
  });

  test('orderBy with aliased column', (ctx) => {
    const { db2: db } = ctx;

    const query = db
      .select({
        test: sql`something`.as('test')
      })
      .from(users2Table)
      .orderBy((fields) => fields.test)
      .toSQL();

    assert.deepEqual(query.sql, 'select something as "test" from "users2" order by "test"');
  });

  test('select from sql', async (ctx) => {
    const { db2: db } = ctx;

    const metricEntry = pgTable('metric_entry', {
      id: pgUuid('id').notNull(),
      createdAt: timestamp('created_at').notNull()
    });

    await db.execute(sql`drop table if exists ${metricEntry}`);
    await db.execute(sql`create table ${metricEntry} (id uuid not null, created_at timestamp not null)`);

    const metricId = uuid();

    const intervals = db.$with('intervals').as(
      db
        .select({
          startTime: sql<string>`(date'2023-03-01'+ x * '1 day'::interval)`.as('start_time'),
          endTime: sql<string>`(date'2023-03-01'+ (x+1) *'1 day'::interval)`.as('end_time')
        })
        .from(sql`generate_series(0, 29, 1) as t(x)`)
    );

    ctx
      .expect(() =>
        db
          .with(intervals)
          .select({
            startTime: intervals.startTime,
            endTime: intervals.endTime,
            count: sql<number>`count(${metricEntry})`
          })
          .from(metricEntry)
          .rightJoin(
            intervals,
            and(
              eq(metricEntry.id, metricId),
              gte(metricEntry.createdAt, intervals.startTime),
              lt(metricEntry.createdAt, intervals.endTime)
            )
          )
          .groupBy(intervals.startTime, intervals.endTime)
          .orderBy(asc(intervals.startTime))
      )
      .not.toThrowError();
  });

  test('timestamp timezone', async (ctx) => {
    const { db2: db } = ctx;

    const usersTableWithAndWithoutTimezone = pgTable('users_test_with_and_without_timezone', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow()
    });

    await db.execute(sql`drop table if exists ${usersTableWithAndWithoutTimezone}`);

    await db.execute(
      sql`
			create table users_test_with_and_without_timezone (
				id serial not null primary key,
				name text not null,
				created_at timestamptz not null default now(),
				updated_at timestamp not null default now()
			)
		`
    );

    const date = new Date(Date.parse('2020-01-01T00:00:00+04:00'));

    await db.insert(usersTableWithAndWithoutTimezone).values({ name: 'With default times' });
    await db.insert(usersTableWithAndWithoutTimezone).values({
      name: 'Without default times',
      createdAt: date,
      updatedAt: date
    });
    const users = await db.select().from(usersTableWithAndWithoutTimezone);

    // check that the timestamps are set correctly for default times
    ctx.expect(Math.abs(users[0]!.updatedAt.getTime() - Date.now()) < 2000);
    ctx.expect(Math.abs(users[0]!.createdAt.getTime() - Date.now()) < 2000);

    // check that the timestamps are set correctly for non default times
    ctx.expect(Math.abs(users[1]!.updatedAt.getTime() - date.getTime()) < 2000);
    ctx.expect(Math.abs(users[1]!.createdAt.getTime() - date.getTime()) < 2000);
  });

  test('transaction', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users_transactions', {
      id: serial('id').primaryKey(),
      balance: integer('balance').notNull()
    });
    const products = pgTable('products_transactions', {
      id: serial('id').primaryKey(),
      price: integer('price').notNull(),
      stock: integer('stock').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);
    await db.execute(sql`drop table if exists ${products}`);

    await db.execute(sql`create table users_transactions (id serial not null primary key, balance integer not null)`);
    await db.execute(
      sql`create table products_transactions (id serial not null primary key, price integer not null, stock integer not null)`
    );

    const user = await db
      .insert(users)
      .values({ balance: 100 })
      .returning()
      .then((rows) => rows[0]!);
    const product = await db
      .insert(products)
      .values({ price: 10, stock: 10 })
      .returning()
      .then((rows) => rows[0]!);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ balance: user.balance - product.price })
        .where(eq(users.id, user.id));
      await tx
        .update(products)
        .set({ stock: product.stock - 1 })
        .where(eq(products.id, product.id));
    });

    const result = await db.select().from(users);

    assert.deepEqual(result, [{ id: 1, balance: 90 }]);

    await db.execute(sql`drop table ${users}`);
    await db.execute(sql`drop table ${products}`);
  });

  test('transaction rollback', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users_transactions_rollback', {
      id: serial('id').primaryKey(),
      balance: integer('balance').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(
      sql`create table users_transactions_rollback (id serial not null primary key, balance integer not null)`
    );

    await ctx
      .expect(
        db.transaction(async (tx) => {
          await tx.insert(users).values({ balance: 100 });
          tx.rollback();
        })
      )
      .rejects.toThrow(TransactionRollbackError);

    const result = await db.select().from(users);

    assert.deepEqual(result, []);

    await db.execute(sql`drop table ${users}`);
  });

  test('nested transaction', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users_nested_transactions', {
      id: serial('id').primaryKey(),
      balance: integer('balance').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(
      sql`create table users_nested_transactions (id serial not null primary key, balance integer not null)`
    );

    await db.transaction(async (tx) => {
      await tx.insert(users).values({ balance: 100 });

      await tx.transaction(async (tx) => {
        await tx.update(users).set({ balance: 200 });
      });
    });

    const result = await db.select().from(users);

    assert.deepEqual(result, [{ id: 1, balance: 200 }]);

    await db.execute(sql`drop table ${users}`);
  });

  test('nested transaction rollback', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users_nested_transactions_rollback', {
      id: serial('id').primaryKey(),
      balance: integer('balance').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(
      sql`create table users_nested_transactions_rollback (id serial not null primary key, balance integer not null)`
    );

    await db.transaction(async (tx) => {
      await tx.insert(users).values({ balance: 100 });

      await ctx
        .expect(
          tx.transaction(async (tx) => {
            await tx.update(users).set({ balance: 200 });
            tx.rollback();
          })
        )
        .rejects.toThrow(TransactionRollbackError);
    });

    const result = await db.select().from(users);

    assert.deepEqual(result, [{ id: 1, balance: 100 }]);

    await db.execute(sql`drop table ${users}`);
  });

  test('join subquery with join', async (ctx) => {
    const { db2: db } = ctx;

    const internalStaff = pgTable('internal_staff', {
      userId: integer('user_id').notNull()
    });

    const customUser = pgTable('custom_user', {
      id: integer('id').notNull()
    });

    const ticket = pgTable('ticket', {
      staffId: integer('staff_id').notNull()
    });

    await db.execute(sql`drop table if exists ${internalStaff}`);
    await db.execute(sql`drop table if exists ${customUser}`);
    await db.execute(sql`drop table if exists ${ticket}`);

    await db.execute(sql`create table internal_staff (user_id integer not null)`);
    await db.execute(sql`create table custom_user (id integer not null)`);
    await db.execute(sql`create table ticket (staff_id integer not null)`);

    await db.insert(internalStaff).values({ userId: 1 });
    await db.insert(customUser).values({ id: 1 });
    await db.insert(ticket).values({ staffId: 1 });

    const subq = db
      .select()
      .from(internalStaff)
      .leftJoin(customUser, eq(internalStaff.userId, customUser.id))
      .as('internal_staff');

    const mainQuery = await db.select().from(ticket).leftJoin(subq, eq(subq.internal_staff.userId, ticket.staffId));

    assert.deepEqual(mainQuery, [
      {
        ticket: { staffId: 1 },
        internal_staff: {
          internal_staff: { userId: 1 },
          custom_user: { id: 1 }
        }
      }
    ]);

    await db.execute(sql`drop table ${internalStaff}`);
    await db.execute(sql`drop table ${customUser}`);
    await db.execute(sql`drop table ${ticket}`);
  });

  notSupported('subquery with view', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users_subquery_view', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      cityId: integer('city_id').notNull()
    });

    const newYorkers = pgView('new_yorkers').as((qb) => qb.select().from(users).where(eq(users.cityId, 1)));

    await db.execute(sql`drop table if exists ${users}`);
    await db.execute(sql`drop view if exists ${newYorkers}`);

    await db.execute(
      sql`create table ${users} (id serial not null primary key, name text not null, city_id integer not null)`
    );
    await db.execute(sql`create view ${newYorkers} as select * from ${users} where city_id = 1`);

    await db.insert(users).values([
      { name: 'John', cityId: 1 },
      { name: 'Jane', cityId: 2 },
      { name: 'Jack', cityId: 1 },
      { name: 'Jill', cityId: 2 }
    ]);

    const sq = db.$with('sq').as(db.select().from(newYorkers));
    const result = await db.with(sq).select().from(sq);

    assert.deepEqual(result, [
      { id: 1, name: 'John', cityId: 1 },
      { id: 3, name: 'Jack', cityId: 1 }
    ]);

    await db.execute(sql`drop view ${newYorkers}`);
    await db.execute(sql`drop table ${users}`);
  });

  notSupported('join view as subquery', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users_join_view', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      cityId: integer('city_id').notNull()
    });

    const newYorkers = pgView('new_yorkers').as((qb) => qb.select().from(users).where(eq(users.cityId, 1)));

    await db.execute(sql`drop table if exists ${users}`);
    await db.execute(sql`drop view if exists ${newYorkers}`);

    await db.execute(
      sql`create table ${users} (id serial not null primary key, name text not null, city_id integer not null)`
    );
    await db.execute(sql`create view ${newYorkers} as select * from ${users} where city_id = 1`);

    await db.insert(users).values([
      { name: 'John', cityId: 1 },
      { name: 'Jane', cityId: 2 },
      { name: 'Jack', cityId: 1 },
      { name: 'Jill', cityId: 2 }
    ]);

    const sq = db.select().from(newYorkers).as('new_yorkers_sq');

    const result = await db.select().from(users).leftJoin(sq, eq(users.id, sq.id));

    assert.deepEqual(result, [
      {
        users_join_view: { id: 1, name: 'John', cityId: 1 },
        new_yorkers_sq: { id: 1, name: 'John', cityId: 1 }
      },
      {
        users_join_view: { id: 2, name: 'Jane', cityId: 2 },
        new_yorkers_sq: null
      },
      {
        users_join_view: { id: 3, name: 'Jack', cityId: 1 },
        new_yorkers_sq: { id: 3, name: 'Jack', cityId: 1 }
      },
      {
        users_join_view: { id: 4, name: 'Jill', cityId: 2 },
        new_yorkers_sq: null
      }
    ]);

    await db.execute(sql`drop view ${newYorkers}`);
    await db.execute(sql`drop table ${users}`);
  });

  test('table selection with single table', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      cityId: integer('city_id').notNull()
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(
      sql`create table ${users} (id serial not null primary key, name text not null, city_id integer not null)`
    );

    await db.insert(users).values({ name: 'John', cityId: 1 });

    const result = await db.select({ users }).from(users);

    assert.deepEqual(result, [{ users: { id: 1, name: 'John', cityId: 1 } }]);

    await db.execute(sql`drop table ${users}`);
  });

  test('set null to jsonb field', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      jsonb: jsonb('jsonb')
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(sql`create table ${users} (id serial not null primary key, jsonb jsonb)`);

    const result = await db.insert(users).values({ jsonb: null }).returning();

    assert.deepEqual(result, [{ id: 1, jsonb: null }]);

    await db.execute(sql`drop table ${users}`);
  });

  test('insert undefined', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name')
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(sql`create table ${users} (id serial not null primary key, name text)`);

    ctx.expect(async () => await db.insert(users).values({ name: undefined })).not.toThrowError();

    await db.execute(sql`drop table ${users}`);
  });

  fixme('update undefined', async (ctx) => {
    const { db2: db } = ctx;

    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name')
    });

    await db.execute(sql`drop table if exists ${users}`);

    await db.execute(sql`create table ${users} (id serial not null primary key, name text)`);

    ctx.expect(async () => await db.update(users).set({ name: undefined })).toThrowError();
    ctx.expect(async () => await db.update(users).set({ id: 1, name: undefined })).not.toThrowError();

    await db.execute(sql`drop table ${users}`);
  });

  test('array operators', async (ctx) => {
    const { db2: db } = ctx;

    const posts = pgTable('posts', {
      id: serial('id').primaryKey(),
      tags: text('tags').array()
    });

    await db.execute(sql`drop table if exists ${posts}`);

    await db.execute(sql`create table ${posts} (id serial primary key, tags text[])`);

    await db.insert(posts).values([
      {
        tags: ['ORM']
      },
      {
        tags: ['Typescript']
      },
      {
        tags: ['Typescript', 'ORM']
      },
      {
        tags: ['Typescript', 'Frontend', 'React']
      },
      {
        tags: ['Typescript', 'ORM', 'Database', 'Postgres']
      },
      {
        tags: ['Java', 'Spring', 'OOP']
      }
    ]);

    const contains = await db
      .select({ id: posts.id })
      .from(posts)
      .where(arrayContains(posts.tags, ['Typescript', 'ORM']));
    const contained = await db
      .select({ id: posts.id })
      .from(posts)
      .where(arrayContained(posts.tags, ['Typescript', 'ORM']));
    const overlaps = await db
      .select({ id: posts.id })
      .from(posts)
      .where(arrayOverlaps(posts.tags, ['Typescript', 'ORM']));
    const withSubQuery = await db
      .select({ id: posts.id })
      .from(posts)
      .where(arrayContains(posts.tags, db.select({ tags: posts.tags }).from(posts).where(eq(posts.id, 1))));

    assert.deepEqual(contains, [{ id: 3 }, { id: 5 }]);
    assert.deepEqual(contained, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.deepEqual(overlaps, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    assert.deepEqual(withSubQuery, [{ id: 1 }, { id: 3 }, { id: 5 }]);
  });

  test('set operations (union) from query builder with subquery', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const sq = db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).as('sq');

    const result = await db
      .select({ id: cities2Table.id, name: citiesTable.name })
      .from(cities2Table)
      .union(db.select().from(sq))
      .orderBy(asc(sql`name`))
      .limit(2)
      .offset(1);

    ctx.expect(result.length === 2);

    assert.deepEqual(result, [
      { id: 3, name: 'Jack' },
      { id: 2, name: 'Jane' }
    ]);

    ctx
      .expect(() => {
        db.select({ id: cities2Table.id, name: citiesTable.name, name2: users2Table.name })
          .from(cities2Table)
          .union(
            // @ts-expect-error
            db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table)
          )
          .orderBy(asc(sql`name`));
      })
      .toThrowError();
  });

  test('set operations (union) as function', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await union(
      db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
    )
      .orderBy(asc(sql`name`))
      .limit(1)
      .offset(1);

    ctx.expect(result.length === 1);

    assert.deepEqual(result, [{ id: 1, name: 'New York' }]);

    ctx
      .expect(() => {
        union(
          db.select({ name: citiesTable.name, id: cities2Table.id }).from(cities2Table).where(eq(citiesTable.id, 1)),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
        ).orderBy(asc(sql`name`));
      })
      .toThrowError();
  });

  test('set operations (union all) from query builder', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await db
      .select({ id: cities2Table.id, name: citiesTable.name })
      .from(cities2Table)
      .limit(2)
      .unionAll(db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).limit(2))
      .orderBy(asc(sql`id`));

    ctx.expect(result.length === 4);

    assert.deepEqual(result, [
      { id: 1, name: 'New York' },
      { id: 1, name: 'New York' },
      { id: 2, name: 'London' },
      { id: 2, name: 'London' }
    ]);

    ctx
      .expect(() => {
        db.select({ id: cities2Table.id, name: citiesTable.name })
          .from(cities2Table)
          .limit(2)
          .unionAll(db.select({ name: citiesTable.name, id: cities2Table.id }).from(cities2Table).limit(2))
          .orderBy(asc(sql`id`));
      })
      .toThrowError();
  });

  test('set operations (union all) as function', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await unionAll(
      db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
    );

    ctx.expect(result.length === 3);

    assert.deepEqual(result, [
      { id: 1, name: 'New York' },
      { id: 1, name: 'John' },
      { id: 1, name: 'John' }
    ]);

    ctx
      .expect(() => {
        unionAll(
          db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1)),
          db.select({ name: users2Table.name, id: users2Table.id }).from(users2Table).where(eq(users2Table.id, 1)),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
        );
      })
      .toThrowError();
  });

  test('set operations (intersect) from query builder', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await db
      .select({ id: cities2Table.id, name: citiesTable.name })
      .from(cities2Table)
      .intersect(
        db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(gt(citiesTable.id, 1))
      )
      .orderBy(asc(sql`name`));

    ctx.expect(result.length === 2);

    assert.deepEqual(result, [
      { id: 2, name: 'London' },
      { id: 3, name: 'Tampa' }
    ]);

    ctx
      .expect(() => {
        db.select({ id: cities2Table.id, name: citiesTable.name })
          .from(cities2Table)
          .intersect(
            // @ts-expect-error
            db
              .select({ id: cities2Table.id, name: citiesTable.name, id2: cities2Table.id })
              .from(cities2Table)
              .where(gt(citiesTable.id, 1))
          )
          .orderBy(asc(sql`name`));
      })
      .toThrowError();
  });

  test('set operations (intersect) as function', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await intersect(
      db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
    );

    ctx.expect(result.length === 0);

    assert.deepEqual(result, []);

    ctx
      .expect(() => {
        intersect(
          db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1)),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
          db.select({ name: users2Table.name, id: users2Table.id }).from(users2Table).where(eq(users2Table.id, 1))
        );
      })
      .toThrowError();
  });

  test('set operations (intersect all) from query builder', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await db
      .select({ id: cities2Table.id, name: citiesTable.name })
      .from(cities2Table)
      .limit(2)
      .intersectAll(db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).limit(2))
      .orderBy(asc(sql`id`));

    ctx.expect(result.length === 2);

    assert.deepEqual(result, [
      { id: 1, name: 'New York' },
      { id: 2, name: 'London' }
    ]);

    ctx
      .expect(() => {
        db.select({ id: cities2Table.id, name: citiesTable.name })
          .from(cities2Table)
          .limit(2)
          .intersectAll(db.select({ name: users2Table.name, id: users2Table.id }).from(cities2Table).limit(2))
          .orderBy(asc(sql`id`));
      })
      .toThrowError();
  });

  test('set operations (intersect all) as function', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await intersectAll(
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
    );

    ctx.expect(result.length === 1);

    assert.deepEqual(result, [{ id: 1, name: 'John' }]);

    ctx
      .expect(() => {
        intersectAll(
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
          db.select({ name: users2Table.name, id: users2Table.id }).from(users2Table).where(eq(users2Table.id, 1)),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
        );
      })
      .toThrowError();
  });

  test('set operations (except) from query builder', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await db
      .select()
      .from(cities2Table)
      .except(db.select().from(cities2Table).where(gt(citiesTable.id, 1)));

    ctx.expect(result.length === 1);

    assert.deepEqual(result, [{ id: 1, name: 'New York' }]);

    ctx
      .expect(() => {
        db.select()
          .from(cities2Table)
          .except(
            db.select({ name: users2Table.name, id: users2Table.id }).from(cities2Table).where(gt(citiesTable.id, 1))
          );
      })
      .toThrowError();
  });

  test('set operations (except) as function', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await except(
      db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table),
      db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
    ).orderBy(asc(sql`id`));

    ctx.expect(result.length === 2);

    assert.deepEqual(result, [
      { id: 2, name: 'London' },
      { id: 3, name: 'Tampa' }
    ]);

    ctx
      .expect(() => {
        except(
          db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table),
          db.select({ name: users2Table.name, id: users2Table.id }).from(cities2Table).where(eq(citiesTable.id, 1)),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
        ).orderBy(asc(sql`id`));
      })
      .toThrowError();
  });

  test('set operations (except all) from query builder', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await db
      .select()
      .from(cities2Table)
      .exceptAll(
        db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1))
      )
      .orderBy(asc(sql`id`));

    ctx.expect(result.length === 2);

    assert.deepEqual(result, [
      { id: 2, name: 'London' },
      { id: 3, name: 'Tampa' }
    ]);

    ctx
      .expect(() => {
        db.select({ name: cities2Table.name, id: cities2Table.id })
          .from(cities2Table)
          .exceptAll(
            db.select({ id: cities2Table.id, name: citiesTable.name }).from(cities2Table).where(eq(citiesTable.id, 1))
          )
          .orderBy(asc(sql`id`));
      })
      .toThrowError();
  });

  test('set operations (except all) as function', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await exceptAll(
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(gt(users2Table.id, 7)),
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
    )
      .orderBy(asc(sql`id`))
      .limit(5)
      .offset(2);

    ctx.expect(result.length === 4);

    assert.deepEqual(result, [
      { id: 4, name: 'Peter' },
      { id: 5, name: 'Ben' },
      { id: 6, name: 'Jill' },
      { id: 7, name: 'Mary' }
    ]);

    ctx
      .expect(() => {
        exceptAll(
          db.select({ name: users2Table.name, id: users2Table.id }).from(users2Table),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(gt(users2Table.id, 7)),
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1))
        ).orderBy(asc(sql`id`));
      })
      .toThrowError();
  });

  test('set operations (mixed) from query builder with subquery', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);
    const sq = db.select().from(cities2Table).where(gt(citiesTable.id, 1)).as('sq');

    const result = await db
      .select()
      .from(cities2Table)
      .except(({ unionAll }) =>
        unionAll(db.select().from(sq), db.select().from(cities2Table).where(eq(citiesTable.id, 2)))
      );

    ctx.expect(result.length === 1);

    assert.deepEqual(result, [{ id: 1, name: 'New York' }]);

    ctx
      .expect(() => {
        db.select()
          .from(cities2Table)
          .except(({ unionAll }) =>
            unionAll(
              db
                .select({ name: cities2Table.name, id: cities2Table.id })
                .from(cities2Table)
                .where(gt(citiesTable.id, 1)),
              db.select().from(cities2Table).where(eq(citiesTable.id, 2))
            )
          );
      })
      .toThrowError();
  });

  test('set operations (mixed all) as function', async (ctx) => {
    const { db2: db } = ctx;

    await setupSetOperationTest(db);

    const result = await union(
      db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
      except(
        db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(gte(users2Table.id, 5)),
        db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 7))
      ),
      db.select().from(cities2Table).where(gt(citiesTable.id, 1))
    ).orderBy(asc(sql`id`));

    ctx.expect(result.length === 6);

    assert.deepEqual(result, [
      { id: 1, name: 'John' },
      { id: 2, name: 'London' },
      { id: 3, name: 'Tampa' },
      { id: 5, name: 'Ben' },
      { id: 6, name: 'Jill' },
      { id: 8, name: 'Sally' }
    ]);

    ctx
      .expect(() => {
        union(
          db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(eq(users2Table.id, 1)),
          except(
            db.select({ id: users2Table.id, name: users2Table.name }).from(users2Table).where(gte(users2Table.id, 5)),
            db.select({ name: users2Table.name, id: users2Table.id }).from(users2Table).where(eq(users2Table.id, 7))
          ),
          db.select().from(cities2Table).where(gt(citiesTable.id, 1))
        ).orderBy(asc(sql`id`));
      })
      .toThrowError();
  });

  test('aggregate function: count', async (ctx) => {
    const { db2: db } = ctx;
    const table = aggregateTable;
    await setupAggregateFunctionsTest(db);

    const result1 = await db.select({ value: count() }).from(table);
    const result2 = await db.select({ value: count(table.a) }).from(table);
    const result3 = await db.select({ value: countDistinct(table.name) }).from(table);

    assert.deepEqual(result1[0]?.value, 7);
    assert.deepEqual(result2[0]?.value, 5);
    assert.deepEqual(result3[0]?.value, 6);
  });

  test('aggregate function: avg', async (ctx) => {
    const { db2: db } = ctx;
    const table = aggregateTable;
    await setupAggregateFunctionsTest(db);

    const result1 = await db.select({ value: avg(table.b) }).from(table);
    const result2 = await db.select({ value: avg(table.nullOnly) }).from(table);
    const result3 = await db.select({ value: avgDistinct(table.b) }).from(table);

    assert.deepEqual(result1[0]?.value, '33.3333333333333333');
    assert.deepEqual(result2[0]?.value, null);
    assert.deepEqual(result3[0]?.value, '42.5000000000000000');
  });

  test('aggregate function: sum', async (ctx) => {
    const { db2: db } = ctx;
    const table = aggregateTable;
    await setupAggregateFunctionsTest(db);

    const result1 = await db.select({ value: sum(table.b) }).from(table);
    const result2 = await db.select({ value: sum(table.nullOnly) }).from(table);
    const result3 = await db.select({ value: sumDistinct(table.b) }).from(table);

    assert.deepEqual(result1[0]?.value, '200');
    assert.deepEqual(result2[0]?.value, null);
    assert.deepEqual(result3[0]?.value, '170');
  });

  test('aggregate function: max', async (ctx) => {
    const { db2: db } = ctx;
    const table = aggregateTable;
    await setupAggregateFunctionsTest(db);

    const result1 = await db.select({ value: max(table.b) }).from(table);
    const result2 = await db.select({ value: max(table.nullOnly) }).from(table);

    assert.deepEqual(result1[0]?.value, 90);
    assert.deepEqual(result2[0]?.value, null);
  });

  test('aggregate function: min', async (ctx) => {
    const { db2: db } = ctx;
    const table = aggregateTable;
    await setupAggregateFunctionsTest(db);

    const result1 = await db.select({ value: min(table.b) }).from(table);
    const result2 = await db.select({ value: min(table.nullOnly) }).from(table);

    assert.deepEqual(result1[0]?.value, 10);
    assert.deepEqual(result2[0]?.value, null);
  });

  test('array mapping and parsing', async (ctx) => {
    const { db2: db } = ctx;

    const arrays = pgTable('arrays_tests', {
      id: serial('id').primaryKey(),
      tags: text('tags').array(),
      nested: text('nested').array().array(),
      numbers: integer('numbers').notNull().array()
    });

    await db.execute(sql`drop table if exists ${arrays}`);
    await db.execute(sql`
		 create table ${arrays} (
		 id serial primary key,
		 tags text[],
		 nested text[][],
		 numbers integer[]
		)
	`);

    await db.insert(arrays).values({
      tags: ['', 'b', 'c'],
      nested: [
        ['1', ''],
        ['3', '\\a']
      ],
      numbers: [1, 2, 3]
    });

    const result = await db.select().from(arrays);

    assert.deepEqual(result, [
      {
        id: 1,
        tags: ['', 'b', 'c'],
        nested: [
          ['1', ''],
          ['3', '\\a']
        ],
        numbers: [1, 2, 3]
      }
    ]);

    await db.execute(sql`drop table ${arrays}`);
  });
});

const randomString = () => {
  return Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
};

async function waitForReplication(): Promise<void> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await api.branches.getBranchList({ workspace, database, region });
  } catch (error) {
    console.log(`Replication not ready yet, retrying...`);
    return await waitForReplication();
  }
}

// shut up eslint you cannot possibly comprehend what's happening here
// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
export function Expect<T extends true>() {}

export type Equal<X, Y extends X> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
