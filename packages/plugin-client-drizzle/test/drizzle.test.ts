import { sql } from 'drizzle-orm';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { boolean, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataApiClient } from '../../client/dist';

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

const client = new Client({
  connectionString: `postgresql://${workspace}:${process.env['XATA_API_KEY']}@${region}.sql.staging-xata.dev:5432/${database}:${branch}`
});

let db: NodePgDatabase<Record<string, never>>;

describe.sequential('Drizzle', () => {
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
    //await api.database.deleteDatabase({ workspace, database });
  });

  beforeEach(async () => {
    await api.branches.createBranch({ workspace, region, database, branch: 'temp' });
    await api.branches.deleteBranch({ workspace, region, database, branch });
    await api.branches.createBranch({ workspace, region, database, branch });
    await api.branches.deleteBranch({ workspace, region, database, branch: 'temp' });

    console.log('Created branch', branch, ' in database', database);
  });

  test('Create table', async () => {
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

    const { schema } = await api.migrations.getSchema({ workspace, region, database, branch });
    expect(Object.keys(schema.tables)).toEqual(['users']);
  });
});
