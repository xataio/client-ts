import { sql } from 'drizzle-orm';
import { XataDatabase, drizzle } from '../src/pg';
import { boolean, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataApiClient } from '../../client/dist';
import { Client } from 'pg';

pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  verified: boolean('verified').notNull().default(false),
  jsonb: jsonb('jsonb').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const api = new XataApiClient({
  apiKey: process.env['XATA_API_KEY'],
  host: 'staging'
});

const workspace = (process.env['XATA_WORKSPACE'] ?? '')?.split('-').pop() ?? '';
const database = `drizzle-test-${Math.random().toString(36).substr(2, 9)}`;
const region = 'eu-west-1';
const branch = 'main';

let db: XataDatabase<Record<string, never>>;

beforeAll(async () => {
  await api.database.createDatabase({
    workspace,
    database,
    data: { region },
    headers: { 'X-Features': 'feat-pgroll-migrations=1' }
  });

  console.log('Created branch', branch, ' in database', database);

  const client = new Client({
    connectionString: `postgresql://${workspace}:${process.env['XATA_API_KEY']}@${region}.sql.staging-xata.dev:5432/${database}:${branch}`
  });

  db = drizzle(client);

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
});

afterAll(async () => {
  //await api.database.deleteDatabase({ workspace, database });
});

beforeEach(async () => {
  const { schema } = await api.migrations.getSchema({ workspace, region, database, branch });
  for (const table of Object.keys(schema.tables)) {
    await db.execute(sql`delete from ${table}`);
  }
});

describe.sequential('Drizzle', () => {
  test('Create table', async () => {
    const { schema } = await api.migrations.getSchema({ workspace, region, database, branch });
    expect(Object.keys(schema.tables)).toEqual(['users']);
  });
});
