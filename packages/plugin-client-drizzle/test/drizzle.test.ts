import {
  boolean,
  char,
  cidr,
  inet,
  integer,
  jsonb,
  macaddr,
  macaddr8,
  pgTable,
  serial,
  text,
  timestamp
} from 'drizzle-orm/pg-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TestEnvironmentResult, setUpTestEnvironment } from '../../../test/utils/setup';
import { XataClient } from '../../codegen/example/xata';
import { XataApiClient } from '../../client/dist';
import { sql } from 'drizzle-orm';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  verified: boolean('verified').notNull().default(false),
  jsonb: jsonb('jsonb').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const citiesTable = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  state: char('state', { length: 2 })
});

const users2Table = pgTable('users2', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  cityId: integer('city_id').references(() => citiesTable.id)
});

const coursesTable = pgTable('courses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => courseCategoriesTable.id)
});

const courseCategoriesTable = pgTable('course_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull()
});

const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  region: text('region').notNull(),
  product: text('product').notNull(),
  amount: integer('amount').notNull(),
  quantity: integer('quantity').notNull()
});

const network = pgTable('network_table', {
  inet: inet('inet').notNull(),
  cidr: cidr('cidr').notNull(),
  macaddr: macaddr('macaddr').notNull(),
  macaddr8: macaddr8('macaddr8').notNull()
});

const salEmp = pgTable('sal_emp', {
  name: text('name'),
  payByQuarter: integer('pay_by_quarter').array(),
  schedule: text('schedule').array().array()
});

const _tictactoe = pgTable('tictactoe', {
  squares: integer('squares').array(3).array(3)
});

const usersMigratorTable = pgTable('users12', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull()
});

const api = new XataApiClient({
  apiKey: process.env['XATA_API_KEY'],
  host: 'staging'
});

const workspace = 'liuv9i';
const database = `drizzle-test-${Math.random().toString(36).substr(2, 9)}`;
const region = 'eu-west-1';
const branch = 'main';

const client = new Client({
  connectionString: `postgresql://${workspace}:${process.env['XATA_API_KEY']}@${region}.sql.staging-xata.dev:5432/${database}:${branch}`,
  ssl: false
});

let db: NodePgDatabase<Record<string, never>>;

beforeAll(async () => {
  await api.database.createDatabase({
    workspace,
    database,
    data: { region },
    headers: { 'X-Features': 'feat-pgroll-migrations=1' }
  });

  await client.connect();

  db = drizzle(client);
});

afterAll(async () => {
  await client.end();

  //await api.database.deleteDatabase({ workspace, database });
});

beforeEach(async () => {
  await api.branches.createBranch({ workspace, region, database, branch: 'temp' });
  await api.branches.deleteBranch({ workspace, region, database, branch });
  await api.branches.createBranch({ workspace, region, database, branch });
  await api.branches.deleteBranch({ workspace, region, database, branch: 'temp' });

  console.log('Created branch', branch, ' in database', database);

  try {
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

    await client.end();
    await client.connect();

    await db.execute(
      sql`
			create table cities (
				id serial primary key,
				name text not null,
				state char(2)
			)
		`
    );

    await client.end();
    await client.connect();

    await db.execute(
      sql`
			create table users2 (
				id serial primary key,
				name text not null,
				city_id integer references cities(id)
			)
		`
    );

    await client.end();
    await client.connect();

    await db.execute(
      sql`
			create table course_categories (
				id serial primary key,
				name text not null
			)
		`
    );

    await client.end();
    await client.connect();

    await db.execute(
      sql`
			create table courses (
				id serial primary key,
				name text not null,
				category_id integer references course_categories(id)
			)
		`
    );

    await client.end();
    await client.connect();

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

    await client.end();
    await client.connect();

    await db.execute(
      sql`
			create table sal_emp (
				name text not null,
				pay_by_quarter integer[] not null,
				schedule text[][] not null
			)
		`
    );

    await client.end();
    await client.connect();

    await db.execute(
      sql`
			create table tictactoe (
				squares integer[3][3] not null
			)
		`
    );

    await client.end();
    await client.connect();
  } catch (error) {
    console.log(error);
  }
});

describe('Drizzle', () => {
  test('foo', async () => {
    expect(1).toBe(1);
  });
});
