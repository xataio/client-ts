import { HostProvider, parseProviderString, XataApiClient } from '@xata.io/client';
import 'dotenv/config';
import { desc, eq, gt, gte, or, placeholder, sql, TransactionRollbackError } from 'drizzle-orm';
import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expectTypeOf, test } from 'vitest';
import { drizzle, type XataDatabase } from '../src/pg';
import * as schema from './schema';

const { usersTable, postsTable, commentsTable, usersToGroupsTable, groupsTable } = schema;

const ENABLE_LOGGING = true;

declare module 'vitest' {
  export interface TestContext {
    db: XataDatabase<typeof schema>;
    client: Client;
    branch: string;
  }
}

const apiKey = process.env.XATA_API_KEY ?? '';
if (apiKey === '') throw new Error('XATA_API_KEY environment variable is not set');

const workspace = (process.env.XATA_WORKSPACE ?? '').split('-').pop() ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const region = process.env.XATA_REGION || 'eu-west-1';

const host = parseProviderString(process.env.XATA_API_PROVIDER) ?? 'production';

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

beforeAll(async () => {
  await api.database.createDatabase({
    workspace,
    database,
    data: { region, branchName: 'main' },
    headers: { 'X-Features': 'feat-pgroll-migrations=1' }
  });

  await waitForReplication();

  const client = new Client({
    connectionString: `postgresql://${workspace}:${apiKey}@${region}.sql.${getDomain(host)}:5432/${database}:main`
  });
  const start = Date.now();
  await client.connect();
  console.log('Connected to database in', Date.now() - start, 'ms');

  const db = drizzle(client, { schema, logger: ENABLE_LOGGING });

  await db.execute(
    sql`
			CREATE TABLE "users" (
				"id" serial PRIMARY KEY NOT NULL,
				"name" text NOT NULL,
				"verified" boolean DEFAULT false NOT NULL,
				"invited_by" int REFERENCES "users"("id")
			);
		`
  );
  await db.execute(
    sql`
			CREATE TABLE IF NOT EXISTS "groups" (
				"id" serial PRIMARY KEY NOT NULL,
				"name" text NOT NULL,
				"description" text
			);
		`
  );
  await db.execute(
    sql`
			CREATE TABLE IF NOT EXISTS "users_to_groups" (
				"id" serial PRIMARY KEY NOT NULL,
				"user_id" int REFERENCES "users"("id"),
				"group_id" int REFERENCES "groups"("id")
			);
		`
  );
  await db.execute(
    sql`
			CREATE TABLE IF NOT EXISTS "posts" (
				"id" serial PRIMARY KEY NOT NULL,
				"content" text NOT NULL,
				"owner_id" int REFERENCES "users"("id"),
				"created_at" timestamp with time zone DEFAULT now() NOT NULL
			);
		`
  );
  await db.execute(
    sql`
			CREATE TABLE IF NOT EXISTS "comments" (
				"id" serial PRIMARY KEY NOT NULL,
				"content" text NOT NULL,
				"creator" int REFERENCES "users"("id"),
				"post_id" int REFERENCES "posts"("id"),
				"created_at" timestamp with time zone DEFAULT now() NOT NULL
			);
		`
  );
  await db.execute(
    sql`
			CREATE TABLE IF NOT EXISTS "comment_likes" (
				"id" serial PRIMARY KEY NOT NULL,
				"creator" int REFERENCES "users"("id"),
				"comment_id" int REFERENCES "comments"("id"),
				"created_at" timestamp with time zone DEFAULT now() NOT NULL
			);
		`
  );

  await client.end();
});

afterAll(async () => {
  await api.database.deleteDatabase({ workspace, database });
});

beforeEach(async (ctx) => {
  ctx.branch = `test-${Math.random().toString(36).substring(7)}`;
  await api.branches.createBranch({ workspace, database, region, branch: ctx.branch, from: 'main' });

  ctx.client = new Client({
    connectionString: `postgresql://${workspace}:${apiKey}@${region}.sql.${getDomain(host)}:5432/${database}:${
      ctx.branch
    }`
  });
  ctx.db = drizzle(ctx.client, { schema, logger: ENABLE_LOGGING });
});

afterEach(async (ctx) => {
  await ctx.client.end();
  await api.branches.deleteBranch({ workspace, database, region, branch: ctx.branch });
});

describe('Drizzle ORM', () => {
  /*
	[Find Many] One relation users+posts
*/

  test('[Find Many] Get users with posts', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      with: {
        posts: true
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    usersWithPosts.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithPosts.length).eq(3);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[1]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[2]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [{ id: 2, ownerId: 2, content: 'Post2', createdAt: usersWithPosts[1]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts[2]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      posts: [{ id: 3, ownerId: 3, content: 'Post3', createdAt: usersWithPosts[2]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + limit posts', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      with: {
        posts: {
          limit: 1
        }
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    usersWithPosts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[0]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[1]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[2]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithPosts.length).eq(3);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[1]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[2]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [{ id: 4, ownerId: 2, content: 'Post2', createdAt: usersWithPosts[1]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts[2]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      posts: [{ id: 6, ownerId: 3, content: 'Post3', createdAt: usersWithPosts[2]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + limit posts and users', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      limit: 2,
      with: {
        posts: {
          limit: 1
        }
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    usersWithPosts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[0]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[1]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithPosts.length).eq(2);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[1]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [{ id: 4, ownerId: 2, content: 'Post2', createdAt: usersWithPosts[1]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + custom fields', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      with: {
        posts: true
      },
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        lowerName: string;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    usersWithPosts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[0]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[1]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));
    usersWithPosts[2]?.posts.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithPosts.length).toEqual(3);
    ctx.expect(usersWithPosts[0]?.posts.length).toEqual(3);
    ctx.expect(usersWithPosts[1]?.posts.length).toEqual(2);
    ctx.expect(usersWithPosts[2]?.posts.length).toEqual(2);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      lowerName: 'dan',
      posts: [
        { id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt },
        {
          id: 2,
          ownerId: 1,
          content: 'Post1.2',
          createdAt: usersWithPosts[0]?.posts[1]?.createdAt
        },
        { id: 3, ownerId: 1, content: 'Post1.3', createdAt: usersWithPosts[0]?.posts[2]?.createdAt }
      ]
    });
    ctx.expect(usersWithPosts[1]).toEqual({
      id: 2,
      name: 'Andrew',
      lowerName: 'andrew',
      verified: false,
      invitedBy: null,
      posts: [
        { id: 4, ownerId: 2, content: 'Post2', createdAt: usersWithPosts[1]?.posts[0]?.createdAt },
        {
          id: 5,
          ownerId: 2,
          content: 'Post2.1',
          createdAt: usersWithPosts[1]?.posts[1]?.createdAt
        }
      ]
    });
    ctx.expect(usersWithPosts[2]).toEqual({
      id: 3,
      name: 'Alex',
      lowerName: 'alex',
      verified: false,
      invitedBy: null,
      posts: [
        { id: 6, ownerId: 3, content: 'Post3', createdAt: usersWithPosts[2]?.posts[0]?.createdAt },
        {
          id: 7,
          ownerId: 3,
          content: 'Post3.1',
          createdAt: usersWithPosts[2]?.posts[1]?.createdAt
        }
      ]
    });
  });

  test('[Find Many] Get users with posts + custom fields + limits', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      limit: 1,
      with: {
        posts: {
          limit: 1
        }
      },
      extras: (usersTable, { sql }) => ({
        lowerName: sql<string>`lower(${usersTable.name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        lowerName: string;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).toEqual(1);
    ctx.expect(usersWithPosts[0]?.posts.length).toEqual(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      lowerName: 'dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: '1' },
      { ownerId: 1, content: '2' },
      { ownerId: 1, content: '3' },
      { ownerId: 2, content: '4' },
      { ownerId: 2, content: '5' },
      { ownerId: 3, content: '6' },
      { ownerId: 3, content: '7' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      with: {
        posts: {
          orderBy: (postsTable, { desc }) => [desc(postsTable.content)]
        }
      },
      orderBy: (usersTable, { desc }) => [desc(usersTable.id)]
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(3);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(2);
    ctx.expect(usersWithPosts[1]?.posts.length).eq(2);
    ctx.expect(usersWithPosts[2]?.posts.length).eq(3);

    ctx.expect(usersWithPosts[2]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [
        { id: 3, ownerId: 1, content: '3', createdAt: usersWithPosts[2]?.posts[2]?.createdAt },
        {
          id: 2,
          ownerId: 1,
          content: '2',
          createdAt: usersWithPosts[2]?.posts[1]?.createdAt
        },
        { id: 1, ownerId: 1, content: '1', createdAt: usersWithPosts[2]?.posts[0]?.createdAt }
      ]
    });
    ctx.expect(usersWithPosts[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [
        {
          id: 5,
          ownerId: 2,
          content: '5',
          createdAt: usersWithPosts[1]?.posts[1]?.createdAt
        },
        { id: 4, ownerId: 2, content: '4', createdAt: usersWithPosts[1]?.posts[0]?.createdAt }
      ]
    });
    ctx.expect(usersWithPosts[0]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      posts: [
        {
          id: 7,
          ownerId: 3,
          content: '7',
          createdAt: usersWithPosts[0]?.posts[1]?.createdAt
        },
        { id: 6, ownerId: 3, content: '6', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }
      ]
    });
  });

  test('[Find Many] Get users with posts + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      where: ({ id }, { eq }) => eq(id, 1),
      with: {
        posts: {
          where: ({ id }, { eq }) => eq(id, 1)
        }
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + where + partial', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {
        id: true,
        name: true
      },
      with: {
        posts: {
          columns: {
            id: true,
            content: true
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        posts: {
          id: number;
          content: string;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      posts: [{ id: 1, content: 'Post1' }]
    });
  });

  test('[Find Many] Get users with posts + where + partial. Did not select posts id, but used it in where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {
        id: true,
        name: true
      },
      with: {
        posts: {
          columns: {
            id: true,
            content: true
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        posts: {
          id: number;
          content: string;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      posts: [{ id: 1, content: 'Post1' }]
    });
  });

  test('[Find Many] Get users with posts + where + partial(true + false)', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {
        id: true,
        name: false
      },
      with: {
        posts: {
          columns: {
            id: true,
            content: false
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        posts: {
          id: number;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      posts: [{ id: 1 }]
    });
  });

  test('[Find Many] Get users with posts + where + partial(false)', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {
        name: false
      },
      with: {
        posts: {
          columns: {
            content: false
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts in transaction', async (ctx) => {
    let usersWithPosts: {
      id: number;
      name: string;
      verified: boolean;
      invitedBy: number | null;
      posts: {
        id: number;
        content: string;
        ownerId: number | null;
        createdAt: Date;
      }[];
    }[] = [];

    await ctx.db.transaction(async (tx) => {
      await tx.insert(usersTable).values([
        { id: 1, name: 'Dan' },
        { id: 2, name: 'Andrew' },
        { id: 3, name: 'Alex' }
      ]);

      await tx.insert(postsTable).values([
        { ownerId: 1, content: 'Post1' },
        { ownerId: 1, content: 'Post1.1' },
        { ownerId: 2, content: 'Post2' },
        { ownerId: 3, content: 'Post3' }
      ]);

      usersWithPosts = await tx.query.usersTable.findMany({
        where: ({ id }, { eq }) => eq(id, 1),
        with: {
          posts: {
            where: ({ id }, { eq }) => eq(id, 1)
          }
        }
      });
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts in rollbacked transaction', async (ctx) => {
    let usersWithPosts: {
      id: number;
      name: string;
      verified: boolean;
      invitedBy: number | null;
      posts: {
        id: number;
        content: string;
        ownerId: number | null;
        createdAt: Date;
      }[];
    }[] = [];

    await ctx
      .expect(
        ctx.db.transaction(async (tx) => {
          await tx.insert(usersTable).values([
            { id: 1, name: 'Dan' },
            { id: 2, name: 'Andrew' },
            { id: 3, name: 'Alex' }
          ]);

          await tx.insert(postsTable).values([
            { ownerId: 1, content: 'Post1' },
            { ownerId: 1, content: 'Post1.1' },
            { ownerId: 2, content: 'Post2' },
            { ownerId: 3, content: 'Post3' }
          ]);

          tx.rollback();

          usersWithPosts = await tx.query.usersTable.findMany({
            where: ({ id }, { eq }) => eq(id, 1),
            with: {
              posts: {
                where: ({ id }, { eq }) => eq(id, 1)
              }
            }
          });
        })
      )
      .rejects.toThrowError(new TransactionRollbackError());

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(0);
  });

  // select only custom
  test('[Find Many] Get only custom fields', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {},
      with: {
        posts: {
          columns: {},
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        lowerName: string;
        posts: {
          lowerName: string;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).toEqual(3);
    ctx.expect(usersWithPosts[0]?.posts.length).toEqual(3);
    ctx.expect(usersWithPosts[1]?.posts.length).toEqual(2);
    ctx.expect(usersWithPosts[2]?.posts.length).toEqual(2);

    ctx.expect(usersWithPosts).toContainEqual({
      lowerName: 'dan',
      posts: [
        { lowerName: 'post1' },
        {
          lowerName: 'post1.2'
        },
        { lowerName: 'post1.3' }
      ]
    });
    ctx.expect(usersWithPosts).toContainEqual({
      lowerName: 'andrew',
      posts: [
        { lowerName: 'post2' },
        {
          lowerName: 'post2.1'
        }
      ]
    });
    ctx.expect(usersWithPosts).toContainEqual({
      lowerName: 'alex',
      posts: [
        { lowerName: 'post3' },
        {
          lowerName: 'post3.1'
        }
      ]
    });
  });

  test('[Find Many] Get only custom fields + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {},
      with: {
        posts: {
          columns: {},
          where: gte(postsTable.id, 2),
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      where: eq(usersTable.id, 1),
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        lowerName: string;
        posts: {
          lowerName: string;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).toEqual(1);
    ctx.expect(usersWithPosts[0]?.posts.length).toEqual(2);

    ctx.expect(usersWithPosts).toContainEqual({
      lowerName: 'dan',
      posts: [{ lowerName: 'post1.2' }, { lowerName: 'post1.3' }]
    });
  });

  test('[Find Many] Get only custom fields + where + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {},
      with: {
        posts: {
          columns: {},
          where: gte(postsTable.id, 2),
          limit: 1,
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      where: eq(usersTable.id, 1),
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        lowerName: string;
        posts: {
          lowerName: string;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).toEqual(1);
    ctx.expect(usersWithPosts[0]?.posts.length).toEqual(1);

    ctx.expect(usersWithPosts).toContainEqual({
      lowerName: 'dan',
      posts: [{ lowerName: 'post1.2' }]
    });
  });

  test('[Find Many] Get only custom fields + where + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findMany({
      columns: {},
      with: {
        posts: {
          columns: {},
          where: gte(postsTable.id, 2),
          orderBy: [desc(postsTable.id)],
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      where: eq(usersTable.id, 1),
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        lowerName: string;
        posts: {
          lowerName: string;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).toEqual(1);
    ctx.expect(usersWithPosts[0]?.posts.length).toEqual(2);

    ctx.expect(usersWithPosts).toContainEqual({
      lowerName: 'dan',
      posts: [{ lowerName: 'post1.3' }, { lowerName: 'post1.2' }]
    });
  });

  // select only custom find one
  test('[Find One] Get only custom fields', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {},
      with: {
        posts: {
          columns: {},
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          lowerName: string;
          posts: {
            lowerName: string;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts?.posts.length).toEqual(3);

    ctx.expect(usersWithPosts).toEqual({
      lowerName: 'dan',
      posts: [
        { lowerName: 'post1' },
        {
          lowerName: 'post1.2'
        },
        { lowerName: 'post1.3' }
      ]
    });
  });

  test('[Find One] Get only custom fields + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {},
      with: {
        posts: {
          columns: {},
          where: gte(postsTable.id, 2),
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      where: eq(usersTable.id, 1),
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          lowerName: string;
          posts: {
            lowerName: string;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts?.posts.length).toEqual(2);

    ctx.expect(usersWithPosts).toEqual({
      lowerName: 'dan',
      posts: [{ lowerName: 'post1.2' }, { lowerName: 'post1.3' }]
    });
  });

  test('[Find One] Get only custom fields + where + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {},
      with: {
        posts: {
          columns: {},
          where: gte(postsTable.id, 2),
          limit: 1,
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      where: eq(usersTable.id, 1),
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          lowerName: string;
          posts: {
            lowerName: string;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts?.posts.length).toEqual(1);

    ctx.expect(usersWithPosts).toEqual({
      lowerName: 'dan',
      posts: [{ lowerName: 'post1.2' }]
    });
  });

  test('[Find One] Get only custom fields + where + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {},
      with: {
        posts: {
          columns: {},
          where: gte(postsTable.id, 2),
          orderBy: [desc(postsTable.id)],
          extras: ({ content }) => ({
            lowerName: sql<string>`lower(${content})`.as('content_lower')
          })
        }
      },
      where: eq(usersTable.id, 1),
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          lowerName: string;
          posts: {
            lowerName: string;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts?.posts.length).toEqual(2);

    ctx.expect(usersWithPosts).toEqual({
      lowerName: 'dan',
      posts: [{ lowerName: 'post1.3' }, { lowerName: 'post1.2' }]
    });
  });

  // columns {}
  test('[Find Many] Get select {}', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    const users = await ctx.db.query.usersTable.findMany({
      columns: {}
    });

    ctx.expect(users.length).toBe(3);

    ctx.expect(users[0]).toEqual({});
    ctx.expect(users[1]).toEqual({});
    ctx.expect(users[2]).toEqual({});
  });

  // columns {}
  test('[Find One] Get select {}', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    const users = await ctx.db.query.usersTable.findFirst({
      columns: {}
    });

    ctx.expect(users).toEqual({});
  });

  // deep select {}
  test('[Find Many] Get deep select {}', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const users = await ctx.db.query.usersTable.findMany({
      columns: {},
      with: {
        posts: {
          columns: {}
        }
      }
    });

    ctx.expect(users.length).toBe(3);

    ctx.expect(users[0]).toEqual({ posts: [{}] });
    ctx.expect(users[1]).toEqual({ posts: [{}] });
    ctx.expect(users[2]).toEqual({ posts: [{}] });
  });

  // deep select {}
  test('[Find One] Get deep select {}', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const users = await ctx.db.query.usersTable.findFirst({
      columns: {},
      with: {
        posts: {
          columns: {}
        }
      }
    });

    ctx.expect(users).toEqual({ posts: [{}] });
  });

  /*
	Prepared statements for users+posts
*/
  test('[Find Many] Get users with posts + prepared limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const prepared = ctx.db.query.usersTable
      .findMany({
        with: {
          posts: {
            limit: placeholder('limit')
          }
        }
      })
      .prepare('query1');

    const usersWithPosts = await prepared.execute({ limit: 1 });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(3);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[1]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[2]?.posts.length).eq(1);

    ctx.expect(usersWithPosts).toContainEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [{ id: 4, ownerId: 2, content: 'Post2', createdAt: usersWithPosts[1]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      posts: [{ id: 6, ownerId: 3, content: 'Post3', createdAt: usersWithPosts[2]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + prepared limit + offset', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const prepared = ctx.db.query.usersTable
      .findMany({
        limit: placeholder('uLimit'),
        offset: placeholder('uOffset'),
        with: {
          posts: {
            limit: placeholder('pLimit')
          }
        }
      })
      .prepare('query2');

    const usersWithPosts = await prepared.execute({ pLimit: 1, uLimit: 3, uOffset: 1 });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(2);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);
    ctx.expect(usersWithPosts[1]?.posts.length).eq(1);

    ctx.expect(usersWithPosts).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [{ id: 4, ownerId: 2, content: 'Post2', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(usersWithPosts).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      posts: [{ id: 6, ownerId: 3, content: 'Post3', createdAt: usersWithPosts[1]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + prepared where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const prepared = ctx.db.query.usersTable
      .findMany({
        where: ({ id }, { eq }) => eq(id, placeholder('id')),
        with: {
          posts: {
            where: ({ id }, { eq }) => eq(id, 1)
          }
        }
      })
      .prepare('query3');

    const usersWithPosts = await prepared.execute({ id: 1 });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
  });

  test('[Find Many] Get users with posts + prepared + limit + offset + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const prepared = ctx.db.query.usersTable
      .findMany({
        limit: placeholder('uLimit'),
        offset: placeholder('uOffset'),
        where: ({ id }, { eq, or }) => or(eq(id, placeholder('id')), eq(id, 3)),
        with: {
          posts: {
            where: ({ id }, { eq }) => eq(id, placeholder('pid')),
            limit: placeholder('pLimit')
          }
        }
      })
      .prepare('query4');

    const usersWithPosts = await prepared.execute({ pLimit: 1, uLimit: 3, uOffset: 1, id: 2, pid: 6 });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
        }[];
      }[]
    >();

    ctx.expect(usersWithPosts.length).eq(1);
    ctx.expect(usersWithPosts[0]?.posts.length).eq(1);

    ctx.expect(usersWithPosts).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      posts: [{ id: 6, ownerId: 3, content: 'Post3', createdAt: usersWithPosts[0]?.posts[0]?.createdAt }]
    });
  });

  /*
	[Find One] One relation users+posts
*/

  test('[Find One] Get users with posts', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      with: {
        posts: true
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts?.posts[0]?.createdAt }]
    });
  });

  test('[Find One] Get users with posts + limit posts', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      with: {
        posts: {
          limit: 1
        }
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts?.posts[0]?.createdAt }]
    });
  });

  test('[Find One] Get users with posts no results found', async (ctx) => {
    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      with: {
        posts: {
          limit: 1
        }
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts).toBeUndefined();
  });

  test('[Find One] Get users with posts + limit posts and users', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      with: {
        posts: {
          limit: 1
        }
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts?.posts[0]?.createdAt }]
    });
  });

  test('[Find One] Get users with posts + custom fields', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      with: {
        posts: true
      },
      extras: ({ name }) => ({
        lowerName: sql<string>`lower(${name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          lowerName: string;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).toEqual(3);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      lowerName: 'dan',
      posts: [
        { id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts?.posts[0]?.createdAt },
        {
          id: 2,
          ownerId: 1,
          content: 'Post1.2',
          createdAt: usersWithPosts?.posts[1]?.createdAt
        },
        { id: 3, ownerId: 1, content: 'Post1.3', createdAt: usersWithPosts?.posts[2]?.createdAt }
      ]
    });
  });

  test('[Find One] Get users with posts + custom fields + limits', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.2' },
      { ownerId: 1, content: 'Post1.3' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      with: {
        posts: {
          limit: 1
        }
      },
      extras: (usersTable, { sql }) => ({
        lowerName: sql<string>`lower(${usersTable.name})`.as('name_lower')
      })
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          lowerName: string;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).toEqual(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      lowerName: 'dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts?.posts[0]?.createdAt }]
    });
  });

  test('[Find One] Get users with posts + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: '1' },
      { ownerId: 1, content: '2' },
      { ownerId: 1, content: '3' },
      { ownerId: 2, content: '4' },
      { ownerId: 2, content: '5' },
      { ownerId: 3, content: '6' },
      { ownerId: 3, content: '7' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      with: {
        posts: {
          orderBy: (postsTable, { desc }) => [desc(postsTable.content)]
        }
      },
      orderBy: (usersTable, { desc }) => [desc(usersTable.id)]
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(2);

    ctx.expect(usersWithPosts).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      posts: [
        {
          id: 7,
          ownerId: 3,
          content: '7',
          createdAt: usersWithPosts?.posts[1]?.createdAt
        },
        { id: 6, ownerId: 3, content: '6', createdAt: usersWithPosts?.posts[0]?.createdAt }
      ]
    });
  });

  test('[Find One] Get users with posts + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      where: ({ id }, { eq }) => eq(id, 1),
      with: {
        posts: {
          where: ({ id }, { eq }) => eq(id, 1)
        }
      }
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          posts: {
            id: number;
            content: string;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: usersWithPosts?.posts[0]?.createdAt }]
    });
  });

  test('[Find One] Get users with posts + where + partial', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {
        id: true,
        name: true
      },
      with: {
        posts: {
          columns: {
            id: true,
            content: true
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          posts: {
            id: number;
            content: string;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      posts: [{ id: 1, content: 'Post1' }]
    });
  });

  test('[Find One] Get users with posts + where + partial. Did not select posts id, but used it in where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {
        id: true,
        name: true
      },
      with: {
        posts: {
          columns: {
            id: true,
            content: true
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          name: string;
          posts: {
            id: number;
            content: string;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      name: 'Dan',
      posts: [{ id: 1, content: 'Post1' }]
    });
  });

  test('[Find One] Get users with posts + where + partial(true + false)', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {
        id: true,
        name: false
      },
      with: {
        posts: {
          columns: {
            id: true,
            content: false
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          posts: {
            id: number;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      posts: [{ id: 1 }]
    });
  });

  test('[Find One] Get users with posts + where + partial(false)', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const usersWithPosts = await ctx.db.query.usersTable.findFirst({
      columns: {
        name: false
      },
      with: {
        posts: {
          columns: {
            content: false
          },
          where: ({ id }, { eq }) => eq(id, 1)
        }
      },
      where: ({ id }, { eq }) => eq(id, 1)
    });

    expectTypeOf(usersWithPosts).toEqualTypeOf<
      | {
          id: number;
          verified: boolean;
          invitedBy: number | null;
          posts: {
            id: number;
            ownerId: number | null;
            createdAt: Date;
          }[];
        }
      | undefined
    >();

    ctx.expect(usersWithPosts!.posts.length).eq(1);

    ctx.expect(usersWithPosts).toEqual({
      id: 1,
      verified: false,
      invitedBy: null,
      posts: [{ id: 1, ownerId: 1, createdAt: usersWithPosts?.posts[0]?.createdAt }]
    });
  });

  /*
	One relation users+users. Self referencing
*/

  test('Get user with invitee', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      with: {
        invitee: true
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    usersWithInvitee.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithInvitee.length).eq(4);
    ctx.expect(usersWithInvitee[0]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[2]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[3]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[2]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null }
    });
    ctx.expect(usersWithInvitee[3]).toEqual({
      id: 4,
      name: 'John',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', verified: false, invitedBy: null }
    });
  });

  test('Get user + limit with invitee', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew', invitedBy: 1 },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      with: {
        invitee: true
      },
      limit: 2
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    usersWithInvitee.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithInvitee.length).eq(2);
    ctx.expect(usersWithInvitee[0]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null }
    });
  });

  test('Get user with invitee and custom fields', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      extras: (users, { sql }) => ({ lower: sql<string>`lower(${users.name})`.as('lower_name') }),
      with: {
        invitee: {
          extras: (invitee, { sql }) => ({ lower: sql<string>`lower(${invitee.name})`.as('lower_name') })
        }
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        lower: string;
        invitedBy: number | null;
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          lower: string;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    usersWithInvitee.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithInvitee.length).eq(4);
    ctx.expect(usersWithInvitee[0]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[2]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[3]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee[0]).toEqual({
      id: 1,
      name: 'Dan',
      lower: 'dan',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[1]).toEqual({
      id: 2,
      name: 'Andrew',
      lower: 'andrew',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[2]).toEqual({
      id: 3,
      name: 'Alex',
      lower: 'alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', lower: 'dan', verified: false, invitedBy: null }
    });
    ctx.expect(usersWithInvitee[3]).toEqual({
      id: 4,
      name: 'John',
      lower: 'john',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', lower: 'andrew', verified: false, invitedBy: null }
    });
  });

  test('Get user with invitee and custom fields + limits', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      extras: (users, { sql }) => ({ lower: sql<string>`lower(${users.name})`.as('lower_name') }),
      limit: 3,
      with: {
        invitee: {
          extras: (invitee, { sql }) => ({ lower: sql<string>`lower(${invitee.name})`.as('lower_name') })
        }
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        lower: string;
        invitedBy: number | null;
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          lower: string;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    usersWithInvitee.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(usersWithInvitee.length).eq(3);
    ctx.expect(usersWithInvitee[0]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[2]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee[0]).toEqual({
      id: 1,
      name: 'Dan',
      lower: 'dan',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[1]).toEqual({
      id: 2,
      name: 'Andrew',
      lower: 'andrew',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[2]).toEqual({
      id: 3,
      name: 'Alex',
      lower: 'alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', lower: 'dan', verified: false, invitedBy: null }
    });
  });

  test('Get user with invitee + order by', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      orderBy: (users, { desc }) => [desc(users.id)],
      with: {
        invitee: true
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    ctx.expect(usersWithInvitee.length).eq(4);
    ctx.expect(usersWithInvitee[3]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[2]?.invitee).toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[0]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee[3]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[2]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      invitee: null
    });
    ctx.expect(usersWithInvitee[1]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null }
    });
    ctx.expect(usersWithInvitee[0]).toEqual({
      id: 4,
      name: 'John',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', verified: false, invitedBy: null }
    });
  });

  test('Get user with invitee + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      where: (users, { eq, or }) => or(eq(users.id, 3), eq(users.id, 4)),
      with: {
        invitee: true
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    ctx.expect(usersWithInvitee.length).eq(2);
    ctx.expect(usersWithInvitee[0]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null }
    });
    ctx.expect(usersWithInvitee).toContainEqual({
      id: 4,
      name: 'John',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', verified: false, invitedBy: null }
    });
  });

  test('Get user with invitee + where + partial', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      where: (users, { eq, or }) => or(eq(users.id, 3), eq(users.id, 4)),
      columns: {
        id: true,
        name: true
      },
      with: {
        invitee: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        invitee: {
          id: number;
          name: string;
        } | null;
      }[]
    >();

    ctx.expect(usersWithInvitee.length).eq(2);
    ctx.expect(usersWithInvitee[0]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee).toContainEqual({
      id: 3,
      name: 'Alex',
      invitee: { id: 1, name: 'Dan' }
    });
    ctx.expect(usersWithInvitee).toContainEqual({
      id: 4,
      name: 'John',
      invitee: { id: 2, name: 'Andrew' }
    });
  });

  test('Get user with invitee + where + partial.  Did not select users id, but used it in where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      where: (users, { eq, or }) => or(eq(users.id, 3), eq(users.id, 4)),
      columns: {
        name: true
      },
      with: {
        invitee: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        name: string;
        invitee: {
          id: number;
          name: string;
        } | null;
      }[]
    >();

    ctx.expect(usersWithInvitee.length).eq(2);
    ctx.expect(usersWithInvitee[0]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee).toContainEqual({
      name: 'Alex',
      invitee: { id: 1, name: 'Dan' }
    });
    ctx.expect(usersWithInvitee).toContainEqual({
      name: 'John',
      invitee: { id: 2, name: 'Andrew' }
    });
  });

  test('Get user with invitee + where + partial(true+false)', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      where: (users, { eq, or }) => or(eq(users.id, 3), eq(users.id, 4)),
      columns: {
        id: true,
        name: true,
        verified: false
      },
      with: {
        invitee: {
          columns: {
            id: true,
            name: true,
            verified: false
          }
        }
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        invitee: {
          id: number;
          name: string;
        } | null;
      }[]
    >();

    ctx.expect(usersWithInvitee.length).eq(2);
    ctx.expect(usersWithInvitee[0]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee).toContainEqual({
      id: 3,
      name: 'Alex',
      invitee: { id: 1, name: 'Dan' }
    });
    ctx.expect(usersWithInvitee).toContainEqual({
      id: 4,
      name: 'John',
      invitee: { id: 2, name: 'Andrew' }
    });
  });

  test('Get user with invitee + where + partial(false)', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    const usersWithInvitee = await ctx.db.query.usersTable.findMany({
      where: (users, { eq, or }) => or(eq(users.id, 3), eq(users.id, 4)),
      columns: {
        verified: false
      },
      with: {
        invitee: {
          columns: {
            name: false
          }
        }
      }
    });

    expectTypeOf(usersWithInvitee).toEqualTypeOf<
      {
        id: number;
        name: string;
        invitedBy: number | null;
        invitee: {
          id: number;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    ctx.expect(usersWithInvitee.length).eq(2);
    ctx.expect(usersWithInvitee[0]?.invitee).not.toBeNull();
    ctx.expect(usersWithInvitee[1]?.invitee).not.toBeNull();

    ctx.expect(usersWithInvitee).toContainEqual({
      id: 3,
      name: 'Alex',
      invitedBy: 1,
      invitee: { id: 1, verified: false, invitedBy: null }
    });
    ctx.expect(usersWithInvitee).toContainEqual({
      id: 4,
      name: 'John',
      invitedBy: 2,
      invitee: { id: 2, verified: false, invitedBy: null }
    });
  });

  /*
	Two first-level relations users+users and users+posts
*/

  test('Get user with invitee and posts', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      with: {
        invitee: true,
        posts: true
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: { id: number; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).eq(4);

    ctx.expect(response[0]?.invitee).toBeNull();
    ctx.expect(response[1]?.invitee).toBeNull();
    ctx.expect(response[2]?.invitee).not.toBeNull();
    ctx.expect(response[3]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(1);
    ctx.expect(response[1]?.posts.length).eq(1);
    ctx.expect(response[2]?.posts.length).eq(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: response[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [{ id: 2, ownerId: 2, content: 'Post2', createdAt: response[1]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null },
      posts: [{ id: 3, ownerId: 3, content: 'Post3', createdAt: response[2]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 4,
      name: 'John',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', verified: false, invitedBy: null },
      posts: []
    });
  });

  test('Get user with invitee and posts + limit posts and users', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      limit: 3,
      with: {
        invitee: true,
        posts: {
          limit: 1
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: { id: number; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).eq(3);

    ctx.expect(response[0]?.invitee).toBeNull();
    ctx.expect(response[1]?.invitee).toBeNull();
    ctx.expect(response[2]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(1);
    ctx.expect(response[1]?.posts.length).eq(1);
    ctx.expect(response[2]?.posts.length).eq(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', createdAt: response[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [{ id: 3, ownerId: 2, content: 'Post2', createdAt: response[1]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null },
      posts: [{ id: 5, ownerId: 3, content: 'Post3', createdAt: response[2]?.posts[0]?.createdAt }]
    });
  });

  test('Get user with invitee and posts + limits + custom fields in each', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      limit: 3,
      extras: (users, { sql }) => ({ lower: sql<string>`lower(${users.name})`.as('lower_name') }),
      with: {
        invitee: {
          extras: (users, { sql }) => ({ lower: sql<string>`lower(${users.name})`.as('lower_invitee_name') })
        },
        posts: {
          limit: 1,
          extras: (posts, { sql }) => ({ lower: sql<string>`lower(${posts.content})`.as('lower_content') })
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        lower: string;
        invitedBy: number | null;
        posts: { id: number; lower: string; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          lower: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).eq(3);

    ctx.expect(response[0]?.invitee).toBeNull();
    ctx.expect(response[1]?.invitee).toBeNull();
    ctx.expect(response[2]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(1);
    ctx.expect(response[1]?.posts.length).eq(1);
    ctx.expect(response[2]?.posts.length).eq(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      lower: 'dan',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [{ id: 1, ownerId: 1, content: 'Post1', lower: 'post1', createdAt: response[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      lower: 'andrew',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [{ id: 3, ownerId: 2, content: 'Post2', lower: 'post2', createdAt: response[1]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      lower: 'alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', lower: 'dan', verified: false, invitedBy: null },
      posts: [{ id: 5, ownerId: 3, content: 'Post3', lower: 'post3', createdAt: response[2]?.posts[0]?.createdAt }]
    });
  });

  test('Get user with invitee and posts + custom fields in each', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      extras: (users, { sql }) => ({ lower: sql<string>`lower(${users.name})`.as('lower_name') }),
      with: {
        invitee: {
          extras: (users, { sql }) => ({ lower: sql<string>`lower(${users.name})`.as('lower_name') })
        },
        posts: {
          extras: (posts, { sql }) => ({ lower: sql<string>`lower(${posts.content})`.as('lower_name') })
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        lower: string;
        invitedBy: number | null;
        posts: { id: number; lower: string; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          lower: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).eq(4);

    ctx.expect(response[0]?.invitee).toBeNull();
    ctx.expect(response[1]?.invitee).toBeNull();
    ctx.expect(response[2]?.invitee).not.toBeNull();
    ctx.expect(response[3]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(2);
    ctx.expect(response[1]?.posts.length).eq(2);
    ctx.expect(response[2]?.posts.length).eq(2);
    ctx.expect(response[3]?.posts.length).eq(0);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      lower: 'dan',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [
        { id: 1, ownerId: 1, content: 'Post1', lower: 'post1', createdAt: response[0]?.posts[0]?.createdAt },
        {
          id: 2,
          ownerId: 1,
          content: 'Post1.1',
          lower: 'post1.1',
          createdAt: response[0]?.posts[1]?.createdAt
        }
      ]
    });
    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      lower: 'andrew',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [
        { id: 3, ownerId: 2, content: 'Post2', lower: 'post2', createdAt: response[1]?.posts[0]?.createdAt },
        {
          id: 4,
          ownerId: 2,
          content: 'Post2.1',
          lower: 'post2.1',
          createdAt: response[1]?.posts[1]?.createdAt
        }
      ]
    });
    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      lower: 'alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', lower: 'dan', verified: false, invitedBy: null },
      posts: [
        { id: 5, ownerId: 3, content: 'Post3', lower: 'post3', createdAt: response[2]?.posts[0]?.createdAt },
        {
          id: 6,
          ownerId: 3,
          content: 'Post3.1',
          lower: 'post3.1',
          createdAt: response[2]?.posts[1]?.createdAt
        }
      ]
    });
    ctx.expect(response).toContainEqual({
      id: 4,
      name: 'John',
      lower: 'john',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', lower: 'andrew', verified: false, invitedBy: null },
      posts: []
    });
  });

  test('Get user with invitee and posts + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      orderBy: (users, { desc }) => [desc(users.id)],
      with: {
        invitee: true,
        posts: {
          orderBy: (posts, { desc }) => [desc(posts.id)]
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: { id: number; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    ctx.expect(response.length).eq(4);

    ctx.expect(response[3]?.invitee).toBeNull();
    ctx.expect(response[2]?.invitee).toBeNull();
    ctx.expect(response[1]?.invitee).not.toBeNull();
    ctx.expect(response[0]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(0);
    ctx.expect(response[1]?.posts.length).eq(1);
    ctx.expect(response[2]?.posts.length).eq(2);
    ctx.expect(response[3]?.posts.length).eq(2);

    ctx.expect(response[3]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [
        { id: 2, ownerId: 1, content: 'Post1.1', createdAt: response[3]?.posts[0]?.createdAt },
        {
          id: 1,
          ownerId: 1,
          content: 'Post1',
          createdAt: response[3]?.posts[1]?.createdAt
        }
      ]
    });
    ctx.expect(response[2]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [
        { id: 4, ownerId: 2, content: 'Post2.1', createdAt: response[2]?.posts[0]?.createdAt },
        {
          id: 3,
          ownerId: 2,
          content: 'Post2',
          createdAt: response[2]?.posts[1]?.createdAt
        }
      ]
    });
    ctx.expect(response[1]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null },
      posts: [
        {
          id: 5,
          ownerId: 3,
          content: 'Post3',
          createdAt: response[3]?.posts[1]?.createdAt
        }
      ]
    });
    ctx.expect(response[0]).toEqual({
      id: 4,
      name: 'John',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', verified: false, invitedBy: null },
      posts: []
    });
  });

  test('Get user with invitee and posts + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      where: (users, { eq, or }) => or(eq(users.id, 2), eq(users.id, 3)),
      with: {
        invitee: true,
        posts: {
          where: (posts, { eq }) => eq(posts.ownerId, 2)
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: { id: number; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).eq(2);

    ctx.expect(response[0]?.invitee).toBeNull();
    ctx.expect(response[1]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(1);
    ctx.expect(response[1]?.posts.length).eq(0);

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      invitee: null,
      posts: [{ id: 2, ownerId: 2, content: 'Post2', createdAt: response[0]?.posts[0]?.createdAt }]
    });
    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null },
      posts: []
    });
  });

  test('Get user with invitee and posts + limit posts and users + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' },
      { ownerId: 3, content: 'Post3.1' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      where: (users, { eq, or }) => or(eq(users.id, 3), eq(users.id, 4)),
      limit: 1,
      with: {
        invitee: true,
        posts: {
          where: (posts, { eq }) => eq(posts.ownerId, 3),
          limit: 1
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: { id: number; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    ctx.expect(response.length).eq(1);

    ctx.expect(response[0]?.invitee).not.toBeNull();
    ctx.expect(response[0]?.posts.length).eq(1);

    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null },
      posts: [{ id: 5, ownerId: 3, content: 'Post3', createdAt: response[0]?.posts[0]?.createdAt }]
    });
  });

  test('Get user with invitee and posts + orderBy + where + custom', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      orderBy: [desc(usersTable.id)],
      where: or(eq(usersTable.id, 3), eq(usersTable.id, 4)),
      extras: {
        lower: sql<string>`lower(${usersTable.name})`.as('lower_name')
      },
      with: {
        invitee: true,
        posts: {
          where: eq(postsTable.ownerId, 3),
          orderBy: [desc(postsTable.id)],
          extras: {
            lower: sql<string>`lower(${postsTable.content})`.as('lower_name')
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        lower: string;
        posts: { id: number; lower: string; ownerId: number | null; content: string; createdAt: Date }[];
        invitee: {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
        } | null;
      }[]
    >();

    ctx.expect(response.length).eq(2);

    ctx.expect(response[1]?.invitee).not.toBeNull();
    ctx.expect(response[0]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(0);
    ctx.expect(response[1]?.posts.length).eq(1);

    ctx.expect(response[1]).toEqual({
      id: 3,
      name: 'Alex',
      lower: 'alex',
      verified: false,
      invitedBy: 1,
      invitee: { id: 1, name: 'Dan', verified: false, invitedBy: null },
      posts: [
        {
          id: 5,
          ownerId: 3,
          content: 'Post3',
          lower: 'post3',
          createdAt: response[1]?.posts[0]?.createdAt
        }
      ]
    });
    ctx.expect(response[0]).toEqual({
      id: 4,
      name: 'John',
      lower: 'john',
      verified: false,
      invitedBy: 2,
      invitee: { id: 2, name: 'Andrew', verified: false, invitedBy: null },
      posts: []
    });
  });

  test('Get user with invitee and posts + orderBy + where + partial + custom', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex', invitedBy: 1 },
      { id: 4, name: 'John', invitedBy: 2 }
    ]);

    await ctx.db.insert(postsTable).values([
      { ownerId: 1, content: 'Post1' },
      { ownerId: 1, content: 'Post1.1' },
      { ownerId: 2, content: 'Post2' },
      { ownerId: 2, content: 'Post2.1' },
      { ownerId: 3, content: 'Post3' }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      orderBy: [desc(usersTable.id)],
      where: or(eq(usersTable.id, 3), eq(usersTable.id, 4)),
      extras: {
        lower: sql<string>`lower(${usersTable.name})`.as('lower_name')
      },
      columns: {
        id: true,
        name: true
      },
      with: {
        invitee: {
          columns: {
            id: true,
            name: true
          },
          extras: {
            lower: sql<string>`lower(${usersTable.name})`.as('lower_name')
          }
        },
        posts: {
          columns: {
            id: true,
            content: true
          },
          where: eq(postsTable.ownerId, 3),
          orderBy: [desc(postsTable.id)],
          extras: {
            lower: sql<string>`lower(${postsTable.content})`.as('lower_name')
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        lower: string;
        posts: { id: number; lower: string; content: string }[];
        invitee: {
          id: number;
          name: string;
          lower: string;
        } | null;
      }[]
    >();

    ctx.expect(response.length).eq(2);

    ctx.expect(response[1]?.invitee).not.toBeNull();
    ctx.expect(response[0]?.invitee).not.toBeNull();

    ctx.expect(response[0]?.posts.length).eq(0);
    ctx.expect(response[1]?.posts.length).eq(1);

    ctx.expect(response[1]).toEqual({
      id: 3,
      name: 'Alex',
      lower: 'alex',
      invitee: { id: 1, name: 'Dan', lower: 'dan' },
      posts: [
        {
          id: 5,
          content: 'Post3',
          lower: 'post3'
        }
      ]
    });
    ctx.expect(response[0]).toEqual({
      id: 4,
      name: 'John',
      lower: 'john',
      invitee: { id: 2, name: 'Andrew', lower: 'andrew' },
      posts: []
    });
  });

  /*
	One two-level relation users+posts+comments
*/

  test('Get user with posts and posts with comments', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { id: 1, ownerId: 1, content: 'Post1' },
      { id: 2, ownerId: 2, content: 'Post2' },
      { id: 3, ownerId: 3, content: 'Post3' }
    ]);

    await ctx.db.insert(commentsTable).values([
      { postId: 1, content: 'Comment1', creator: 2 },
      { postId: 2, content: 'Comment2', creator: 2 },
      { postId: 3, content: 'Comment3', creator: 3 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      with: {
        posts: {
          with: {
            comments: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
          comments: {
            id: number;
            content: string;
            createdAt: Date;
            creator: number | null;
            postId: number | null;
          }[];
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).eq(3);
    ctx.expect(response[0]?.posts.length).eq(1);
    ctx.expect(response[1]?.posts.length).eq(1);
    ctx.expect(response[2]?.posts.length).eq(1);

    ctx.expect(response[0]?.posts[0]?.comments.length).eq(1);
    ctx.expect(response[1]?.posts[0]?.comments.length).eq(1);
    ctx.expect(response[2]?.posts[0]?.comments.length).eq(1);

    ctx.expect(response[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [
        {
          id: 1,
          ownerId: 1,
          content: 'Post1',
          createdAt: response[0]?.posts[0]?.createdAt,
          comments: [
            {
              id: 1,
              content: 'Comment1',
              creator: 2,
              postId: 1,
              createdAt: response[0]?.posts[0]?.comments[0]?.createdAt
            }
          ]
        }
      ]
    });
    ctx.expect(response[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [
        {
          id: 2,
          ownerId: 2,
          content: 'Post2',
          createdAt: response[1]?.posts[0]?.createdAt,
          comments: [
            {
              id: 2,
              content: 'Comment2',
              creator: 2,
              postId: 2,
              createdAt: response[1]?.posts[0]?.comments[0]?.createdAt
            }
          ]
        }
      ]
    });
    // ctx.expect(response[2]).toEqual({
    // 	id: 3,
    // 	name: 'Alex',
    // 	verified: false,
    // 	invitedBy: null,
    // 	posts: [{
    // 		id: 3,
    // 		ownerId: 3,
    // 		content: 'Post3',
    // 		createdAt: response[2]?.posts[0]?.createdAt,
    // 		comments: [
    // 			{
    // 				id: ,
    // 				content: 'Comment3',
    // 				creator: 3,
    // 				postId: 3,
    // 				createdAt: response[2]?.posts[0]?.comments[0]?.createdAt,
    // 			},
    // 		],
    // 	}],
    // });
  });

  // Get user with limit posts and limit comments

  // Get user with custom field + post + comment with custom field

  // Get user with limit + posts orderBy + comment orderBy

  // Get user with where + posts where + comment where

  // Get user with where + posts partial where + comment where

  // Get user with where + posts partial where + comment partial(false) where

  // Get user with where partial(false) + posts partial where partial(false) + comment partial(false+true) where

  // Get user with where + posts partial where + comment where. Didn't select field from where in posts

  // Get user with where + posts partial where + comment where. Didn't select field from where for all

  // Get with limit+offset in each

  /*
	One two-level + One first-level relation users+posts+comments and users+users
*/

  /*
	One three-level relation users+posts+comments+comment_owner
*/

  test('Get user with posts and posts with comments and comments with owner', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(postsTable).values([
      { id: 1, ownerId: 1, content: 'Post1' },
      { id: 2, ownerId: 2, content: 'Post2' },
      { id: 3, ownerId: 3, content: 'Post3' }
    ]);

    await ctx.db.insert(commentsTable).values([
      { postId: 1, content: 'Comment1', creator: 2 },
      { postId: 2, content: 'Comment2', creator: 2 },
      { postId: 3, content: 'Comment3', creator: 3 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      with: {
        posts: {
          with: {
            comments: {
              with: {
                author: true
              }
            }
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        posts: {
          id: number;
          content: string;
          ownerId: number | null;
          createdAt: Date;
          comments: {
            id: number;
            content: string;
            createdAt: Date;
            creator: number | null;
            postId: number | null;
            author: {
              id: number;
              name: string;
              verified: boolean;
              invitedBy: number | null;
            } | null;
          }[];
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).eq(3);
    ctx.expect(response[0]?.posts.length).eq(1);
    ctx.expect(response[1]?.posts.length).eq(1);
    ctx.expect(response[2]?.posts.length).eq(1);

    ctx.expect(response[0]?.posts[0]?.comments.length).eq(1);
    ctx.expect(response[1]?.posts[0]?.comments.length).eq(1);
    ctx.expect(response[2]?.posts[0]?.comments.length).eq(1);

    ctx.expect(response[0]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      posts: [
        {
          id: 1,
          ownerId: 1,
          content: 'Post1',
          createdAt: response[0]?.posts[0]?.createdAt,
          comments: [
            {
              id: 1,
              content: 'Comment1',
              creator: 2,
              author: {
                id: 2,
                name: 'Andrew',
                verified: false,
                invitedBy: null
              },
              postId: 1,
              createdAt: response[0]?.posts[0]?.comments[0]?.createdAt
            }
          ]
        }
      ]
    });
    ctx.expect(response[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      posts: [
        {
          id: 2,
          ownerId: 2,
          content: 'Post2',
          createdAt: response[1]?.posts[0]?.createdAt,
          comments: [
            {
              id: 2,
              content: 'Comment2',
              creator: 2,
              author: {
                id: 2,
                name: 'Andrew',
                verified: false,
                invitedBy: null
              },
              postId: 2,
              createdAt: response[1]?.posts[0]?.comments[0]?.createdAt
            }
          ]
        }
      ]
    });
  });

  /*
	One three-level relation + 1 first-level relatioon
	1. users+posts+comments+comment_owner
	2. users+users
*/

  /*
	One four-level relation users+posts+comments+coment_likes
*/

  /*
	[Find Many] Many-to-many cases

	Users+users_to_groups+groups
*/

  test('[Find Many] Get users with groups', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      with: {
        usersToGroups: {
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        usersToGroups: {
          group: {
            id: number;
            name: string;
            description: string | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(3);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[2]?.usersToGroups.length).toEqual(2);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            description: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 3,
            name: 'Group3',
            description: null
          }
        },
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get groups with users', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findMany({
      with: {
        usersToGroups: {
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        description: string | null;
        usersToGroups: {
          user: {
            id: number;
            name: string;
            verified: boolean;
            invitedBy: number | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(3);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(2);
    ctx.expect(response[2]?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Group1',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 1,
            name: 'Dan',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 2,
            name: 'Andrew',
            verified: false,
            invitedBy: null
          }
        },
        {
          user: {
            id: 3,
            name: 'Alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Group3',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 3,
            name: 'Alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get users with groups + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 2, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      limit: 2,
      with: {
        usersToGroups: {
          limit: 1,
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        usersToGroups: {
          group: {
            id: number;
            name: string;
            description: string | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(2);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            description: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get groups with users + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findMany({
      limit: 2,
      with: {
        usersToGroups: {
          limit: 1,
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        description: string | null;
        usersToGroups: {
          user: {
            id: number;
            name: string;
            verified: boolean;
            invitedBy: number | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(2);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Group1',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 1,
            name: 'Dan',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 2,
            name: 'Andrew',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get users with groups + limit + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 2, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      limit: 1,
      where: (_, { eq, or }) => or(eq(usersTable.id, 1), eq(usersTable.id, 2)),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.groupId, 1),
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        usersToGroups: {
          group: {
            id: number;
            name: string;
            description: string | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(1);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            description: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get groups with users + limit + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findMany({
      limit: 1,
      where: gt(groupsTable.id, 1),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.userId, 2),
          limit: 1,
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        description: string | null;
        usersToGroups: {
          user: {
            id: number;
            name: string;
            verified: boolean;
            invitedBy: number | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(1);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 2,
            name: 'Andrew',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get users with groups + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 2, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      where: (_, { eq, or }) => or(eq(usersTable.id, 1), eq(usersTable.id, 2)),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.groupId, 2),
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        usersToGroups: {
          group: {
            id: number;
            name: string;
            description: string | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(2);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(0);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: []
    });

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get groups with users + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findMany({
      where: gt(groupsTable.id, 1),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.userId, 2),
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        description: string | null;
        usersToGroups: {
          user: {
            id: number;
            name: string;
            verified: boolean;
            invitedBy: number | null;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(2);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(0);

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 2,
            name: 'Andrew',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Group3',
      description: null,
      usersToGroups: []
    });
  });

  test('[Find Many] Get users with groups + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      orderBy: (users, { desc }) => [desc(users.id)],
      with: {
        usersToGroups: {
          orderBy: [desc(usersToGroupsTable.groupId)],
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        usersToGroups: {
          group: {
            id: number;
            name: string;
            description: string | null;
          };
        }[];
      }[]
    >();

    ctx.expect(response.length).toEqual(3);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(2);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[2]?.usersToGroups.length).toEqual(1);

    ctx.expect(response[2]).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            description: null
          }
        }
      ]
    });

    ctx.expect(response[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });

    ctx.expect(response[0]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 3,
            name: 'Group3',
            description: null
          }
        },
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get groups with users + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findMany({
      orderBy: [desc(groupsTable.id)],
      with: {
        usersToGroups: {
          orderBy: (utg, { desc }) => [desc(utg.userId)],
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        description: string | null;
        usersToGroups: {
          user: {
            id: number;
            name: string;
            verified: boolean;
            invitedBy: number | null;
          };
        }[];
      }[]
    >();

    ctx.expect(response.length).toEqual(3);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(2);
    ctx.expect(response[2]?.usersToGroups.length).toEqual(1);

    ctx.expect(response[2]).toEqual({
      id: 1,
      name: 'Group1',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 1,
            name: 'Dan',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response[1]).toEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 3,
            name: 'Alex',
            verified: false,
            invitedBy: null
          }
        },
        {
          user: {
            id: 2,
            name: 'Andrew',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response[0]).toEqual({
      id: 3,
      name: 'Group3',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 3,
            name: 'Alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find Many] Get users with groups + orderBy + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      orderBy: (users, { desc }) => [desc(users.id)],
      limit: 2,
      with: {
        usersToGroups: {
          limit: 1,
          orderBy: [desc(usersToGroupsTable.groupId)],
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        usersToGroups: {
          group: {
            id: number;
            name: string;
            description: string | null;
          };
        }[];
      }[]
    >();

    ctx.expect(response.length).toEqual(2);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);

    ctx.expect(response[1]).toEqual({
      id: 2,
      name: 'Andrew',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });

    ctx.expect(response[0]).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 3,
            name: 'Group3',
            description: null
          }
        }
      ]
    });
  });

  /*
	[Find One] Many-to-many cases

	Users+users_to_groups+groups
*/

  test('[Find One] Get users with groups', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findFirst({
      with: {
        usersToGroups: {
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          usersToGroups: {
            group: {
              id: number;
              name: string;
              description: string | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            description: null
          }
        }
      ]
    });
  });

  test('[Find One] Get groups with users', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findFirst({
      with: {
        usersToGroups: {
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          description: string | null;
          usersToGroups: {
            user: {
              id: number;
              name: string;
              verified: boolean;
              invitedBy: number | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 1,
      name: 'Group1',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 1,
            name: 'Dan',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find One] Get users with groups + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 2, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findFirst({
      with: {
        usersToGroups: {
          limit: 1,
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          usersToGroups: {
            group: {
              id: number;
              name: string;
              description: string | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            description: null
          }
        }
      ]
    });
  });

  test('[Find One] Get groups with users + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findFirst({
      with: {
        usersToGroups: {
          limit: 1,
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          description: string | null;
          usersToGroups: {
            user: {
              id: number;
              name: string;
              verified: boolean;
              invitedBy: number | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 1,
      name: 'Group1',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 1,
            name: 'Dan',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find One] Get users with groups + limit + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 2, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findFirst({
      where: (_, { eq, or }) => or(eq(usersTable.id, 1), eq(usersTable.id, 2)),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.groupId, 1),
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          usersToGroups: {
            group: {
              id: number;
              name: string;
              description: string | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            description: null
          }
        }
      ]
    });
  });

  test('[Find One] Get groups with users + limit + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findFirst({
      where: gt(groupsTable.id, 1),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.userId, 2),
          limit: 1,
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          description: string | null;
          usersToGroups: {
            user: {
              id: number;
              name: string;
              verified: boolean;
              invitedBy: number | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 2,
            name: 'Andrew',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find One] Get users with groups + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 2, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findFirst({
      where: (_, { eq, or }) => or(eq(usersTable.id, 1), eq(usersTable.id, 2)),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.groupId, 2),
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          usersToGroups: {
            group: {
              id: number;
              name: string;
              description: string | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(0);

    ctx.expect(response).toEqual({
      id: 1,
      name: 'Dan',
      verified: false,
      invitedBy: null,
      usersToGroups: []
    });
  });

  test('[Find One] Get groups with users + where', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findFirst({
      where: gt(groupsTable.id, 1),
      with: {
        usersToGroups: {
          where: eq(usersToGroupsTable.userId, 2),
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          description: string | null;
          usersToGroups: {
            user: {
              id: number;
              name: string;
              verified: boolean;
              invitedBy: number | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 2,
            name: 'Andrew',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find One] Get users with groups + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findFirst({
      orderBy: (users, { desc }) => [desc(users.id)],
      with: {
        usersToGroups: {
          orderBy: [desc(usersToGroupsTable.groupId)],
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          usersToGroups: {
            group: {
              id: number;
              name: string;
              description: string | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(2);

    ctx.expect(response).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 3,
            name: 'Group3',
            description: null
          }
        },
        {
          group: {
            id: 2,
            name: 'Group2',
            description: null
          }
        }
      ]
    });
  });

  test('[Find One] Get groups with users + orderBy', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findFirst({
      orderBy: [desc(groupsTable.id)],
      with: {
        usersToGroups: {
          orderBy: (utg, { desc }) => [desc(utg.userId)],
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          description: string | null;
          usersToGroups: {
            user: {
              id: number;
              name: string;
              verified: boolean;
              invitedBy: number | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 3,
      name: 'Group3',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 3,
            name: 'Alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('[Find One] Get users with groups + orderBy + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findFirst({
      orderBy: (users, { desc }) => [desc(users.id)],
      with: {
        usersToGroups: {
          limit: 1,
          orderBy: [desc(usersToGroupsTable.groupId)],
          columns: {},
          with: {
            group: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      | {
          id: number;
          name: string;
          verified: boolean;
          invitedBy: number | null;
          usersToGroups: {
            group: {
              id: number;
              name: string;
              description: string | null;
            };
          }[];
        }
      | undefined
    >();

    ctx.expect(response?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toEqual({
      id: 3,
      name: 'Alex',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 3,
            name: 'Group3',
            description: null
          }
        }
      ]
    });
  });

  test('Get groups with users + orderBy + limit', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findMany({
      orderBy: [desc(groupsTable.id)],
      limit: 2,
      with: {
        usersToGroups: {
          limit: 1,
          orderBy: (utg, { desc }) => [desc(utg.userId)],
          columns: {},
          with: {
            user: true
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        description: string | null;
        usersToGroups: {
          user: {
            id: number;
            name: string;
            verified: boolean;
            invitedBy: number | null;
          };
        }[];
      }[]
    >();

    ctx.expect(response.length).toEqual(2);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);

    ctx.expect(response[1]).toEqual({
      id: 2,
      name: 'Group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 3,
            name: 'Alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response[0]).toEqual({
      id: 3,
      name: 'Group3',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 3,
            name: 'Alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('Get users with groups + custom', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.usersTable.findMany({
      extras: {
        lower: sql<string>`lower(${usersTable.name})`.as('lower_name')
      },
      with: {
        usersToGroups: {
          columns: {},
          with: {
            group: {
              extras: {
                lower: sql<string>`lower(${groupsTable.name})`.as('lower_name')
              }
            }
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        verified: boolean;
        invitedBy: number | null;
        lower: string;
        usersToGroups: {
          group: {
            id: number;
            name: string;
            description: string | null;
            lower: string;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(3);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[2]?.usersToGroups.length).toEqual(2);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Dan',
      lower: 'dan',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 1,
            name: 'Group1',
            lower: 'group1',
            description: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Andrew',
      lower: 'andrew',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 2,
            name: 'Group2',
            lower: 'group2',
            description: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Alex',
      lower: 'alex',
      verified: false,
      invitedBy: null,
      usersToGroups: [
        {
          group: {
            id: 3,
            name: 'Group3',
            lower: 'group3',
            description: null
          }
        },
        {
          group: {
            id: 2,
            name: 'Group2',
            lower: 'group2',
            description: null
          }
        }
      ]
    });
  });

  test('Get groups with users + custom', async (ctx) => {
    await ctx.db.insert(usersTable).values([
      { id: 1, name: 'Dan' },
      { id: 2, name: 'Andrew' },
      { id: 3, name: 'Alex' }
    ]);

    await ctx.db.insert(groupsTable).values([
      { id: 1, name: 'Group1' },
      { id: 2, name: 'Group2' },
      { id: 3, name: 'Group3' }
    ]);

    await ctx.db.insert(usersToGroupsTable).values([
      { userId: 1, groupId: 1 },
      { userId: 2, groupId: 2 },
      { userId: 3, groupId: 3 },
      { userId: 3, groupId: 2 }
    ]);

    const response = await ctx.db.query.groupsTable.findMany({
      extras: (table, { sql }) => ({
        lower: sql<string>`lower(${table.name})`.as('lower_name')
      }),
      with: {
        usersToGroups: {
          columns: {},
          with: {
            user: {
              extras: (table, { sql }) => ({
                lower: sql<string>`lower(${table.name})`.as('lower_name')
              })
            }
          }
        }
      }
    });

    expectTypeOf(response).toEqualTypeOf<
      {
        id: number;
        name: string;
        description: string | null;
        lower: string;
        usersToGroups: {
          user: {
            id: number;
            name: string;
            verified: boolean;
            invitedBy: number | null;
            lower: string;
          };
        }[];
      }[]
    >();

    response.sort((a, b) => (a.id > b.id ? 1 : -1));

    ctx.expect(response.length).toEqual(3);

    ctx.expect(response[0]?.usersToGroups.length).toEqual(1);
    ctx.expect(response[1]?.usersToGroups.length).toEqual(2);
    ctx.expect(response[2]?.usersToGroups.length).toEqual(1);

    ctx.expect(response).toContainEqual({
      id: 1,
      name: 'Group1',
      lower: 'group1',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 1,
            name: 'Dan',
            lower: 'dan',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 2,
      name: 'Group2',
      lower: 'group2',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 2,
            name: 'Andrew',
            lower: 'andrew',
            verified: false,
            invitedBy: null
          }
        },
        {
          user: {
            id: 3,
            name: 'Alex',
            lower: 'alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });

    ctx.expect(response).toContainEqual({
      id: 3,
      name: 'Group3',
      lower: 'group3',
      description: null,
      usersToGroups: [
        {
          user: {
            id: 3,
            name: 'Alex',
            lower: 'alex',
            verified: false,
            invitedBy: null
          }
        }
      ]
    });
  });

  test('.toSQL()', (ctx) => {
    const query = ctx.db.query.usersTable.findFirst().toSQL();

    ctx.expect(query).toHaveProperty('sql', ctx.expect.any(String));
    ctx.expect(query).toHaveProperty('params', ctx.expect.any(Array));
  });
});

async function waitForReplication(): Promise<void> {
  try {
    await api.branches.getBranchList({ workspace, database, region });
  } catch (error) {
    console.log(`Waiting for create database replication to finish...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await waitForReplication();
  }
}
