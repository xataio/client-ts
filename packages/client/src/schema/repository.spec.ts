import { expect, test } from 'vitest';
import { KyselyPlugin } from '../kysely';
import { columnSelectionObject, generateSelectStatement } from './repository';
import { XataPluginOptions } from '../plugins';

const foreignKeys = Object.values({
  owner_owner: {
    name: 'owner_owner',
    columns: ['owner'],
    referencedTable: 'users',
    referencedColumns: ['xata_id'],
    onDelete: 'SET NULL'
  },
  pet_pet: {
    name: 'pet_pet',
    columns: ['pet'],
    referencedTable: 'pets',
    referencedColumns: ['xata_id'],
    onDelete: 'SET NULL'
  }
});

const clientOptions = {
  apiKey: 'dummyApiKey',
  apiUrl: '',
  branch: 'main',
  fetch: {} as any,
  host: 'staging',
  schema: {} as any,
  trace: {} as any,
  workspacesApiUrl: 'https://dummy-workspace.eu-west-1.staging-xata.dev/db/dummy-database'
} as XataPluginOptions;

test('link selection', () => {
  const input = ['name', 'owner.*', 'owner.pet.*', 'owner.full_name', 'xata_id'];
  const res = columnSelectionObject(input, foreignKeys);
  expect(res).toEqual({
    links: {
      owner: {
        links: {
          pet: {
            links: {},
            regular: ['*']
          }
        },
        regular: ['*', 'full_name']
      }
    },
    regular: ['name', 'xata_id']
  });
});

test('link selection to kysely selects', () => {
  const input = {
    links: {
      owner: {
        links: {
          pet: {
            links: {},
            regular: ['*']
          }
        },
        regular: ['full_name']
      }
    },
    regular: ['xata_id', 'name']
  };
  const db = new KyselyPlugin().build(clientOptions);
  const tableName = 'teams';
  let statement = db.selectFrom(tableName);

  statement = generateSelectStatement({
    columnSelectionObject: input,
    foreignKeys,
    primaryKey: 'xata_id',
    stmt: statement,
    tableName
  }) as any;

  expect(statement.compile().sql).toBe(
    `select "xata_id", "name", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet") as obj) as "pet" from "users" where "xata_id" = "teams"."owner") as obj) as "owner" from "teams"`
  );
});

test('filterToKysely', () => {
  const input = {
    links: {
      owner: {
        links: {
          pet: {
            links: {},
            regular: ['*']
          }
        },
        regular: ['full_name']
      }
    },
    regular: ['xata_id', 'name']
  };

  const db = new KyselyPlugin().build(clientOptions);
  const tableName = 'teams';

  const filter = { owner: { full_name: { $is: 'r1' } }, pet: { name: { $is: 'r2' } } };
  let statement = db.selectFrom(tableName);
  statement = generateSelectStatement({
    filter: filter,
    columnSelectionObject: input,
    foreignKeys,
    primaryKey: 'xata_id',
    stmt: statement,
    tableName
  }) as any;

  expect(statement.compile().sql).toBe(
    `select "xata_id", "name", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet" and "name" = $1) as obj) as "pet" from "users" where "xata_id" = "teams"."owner" and "full_name" = $2) as obj) as "owner" from "teams"`
  );

  const filter2 = { owner: { full_name: { $is: 'r1' } } };
  let statement2 = db.selectFrom(tableName);
  statement2 = generateSelectStatement({
    filter: filter2,
    columnSelectionObject: input,
    foreignKeys,
    primaryKey: 'xata_id',
    stmt: statement2,
    tableName
  }) as any;
  expect(statement2.compile().sql).toBe(
    `select "xata_id", "name", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet") as obj) as "pet" from "users" where "xata_id" = "teams"."owner" and "full_name" = $1) as obj) as "owner" from "teams"`
  );

  const filter3 = { $not: { pet: { $any: [{ name: 'r1' }, { name: 'r2' }] } } };
  let statement3 = db.selectFrom(tableName);
  statement3 = generateSelectStatement({
    filter: filter3,
    columnSelectionObject: input,
    foreignKeys,
    primaryKey: 'xata_id',
    stmt: statement3,
    tableName
  }) as any;
  expect(statement3.compile().sql).toBe(
    `select "xata_id", "name", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet" and not (CAST ("name" AS text) = $1 or CAST ("name" AS text) = $2)) as obj) as "pet" from "users" where "xata_id" = "teams"."owner") as obj) as "owner" from "teams"`
  );

  // VALUE is a column that were looking for
  const filter4 = { $not: { pet: { $any: [{ name: 'pet' }, { name: 'r2' }] } }, owner: { full_name: { $is: 'pet' } } };
  let statement4 = db.selectFrom(tableName);
  statement4 = generateSelectStatement({
    filter: filter4,
    columnSelectionObject: input,
    foreignKeys,
    primaryKey: 'xata_id',
    stmt: statement4,
    tableName
  }) as any;
  expect(statement4.compile().sql).toBe(
    `select "xata_id", "name", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet" and not (CAST ("name" AS text) = $1 or CAST ("name" AS text) = $2)) as obj) as "pet" from "users" where "xata_id" = "teams"."owner" and "full_name" = $3) as obj) as "owner" from "teams"`
  );

  // todo top level filters
  // todo nested filters +2 levels
});
