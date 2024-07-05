import { expect, test } from 'vitest';
import { KyselyPlugin } from '../kysely';
import { columnSelectionObject, generateSelectStatement } from './repository';
import { XataPluginOptions } from '../plugins';

const teamsForeignKeys = {
  owner_owner: {
    name: 'owner_owner',
    columns: ['owner'],
    referencedTable: 'users',
    referencedColumns: ['xata_id'],
    onDelete: 'SET NULL'
  }
};

const usersForeignKeys = {
  pet_pet: {
    name: 'pet_pet',
    columns: ['pet'],
    referencedTable: 'pets',
    referencedColumns: ['xata_id'],
    onDelete: 'SET NULL'
  }
};

const schema = {
  tables: [
    {
      name: 'teams',
      foreignKeys: teamsForeignKeys
    },
    {
      name: 'users',
      foreignKeys: usersForeignKeys
    }
  ]
};

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
  const res = columnSelectionObject(input);
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
  const columns = ['name', 'owner.pet.*', 'owner.full_name', 'xata_id'];

  const db = new KyselyPlugin().build(clientOptions);
  const tableName = 'teams';
  let statement = db.selectFrom(tableName);

  statement = generateSelectStatement({
    filter: {},
    columnData: [],
    columns,
    schema,
    db: db,
    primaryKey: 'xata_id',
    stmt: statement,
    tableName
  }) as any;

  expect(statement.compile().sql).toBe(
    `select "name", "xata_id", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet") as obj) as "pet" from "users" where "xata_id" = "teams"."owner") as obj) as "owner" from "teams"`
  );
});

test('link selection to kysely selects with filter', () => {
  const columns = ['owner.pet.*', 'owner.full_name'];
  const db = new KyselyPlugin().build(clientOptions);
  const tableName = 'teams';
  let statement = db.selectFrom(tableName);

  const filter = {
    owner: {
      full_name: { $isNot: 'John Doe' },
      pet: {
        name: {
          $isNot: 'thirdlevelPropagain'
        }
      }
    },
    name: 'Team animals'
  };
  statement = generateSelectStatement({
    filter,
    columnData: [],
    columns,
    schema,
    primaryKey: 'xata_id',
    stmt: statement,
    tableName,
    db
  }) as any;

  expect(statement.compile().sql).toBe(
    `select * from (select "xata_id", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet" and "name" != $1) as obj where obj is not null) as "pet" from "users" where "xata_id" = "teams"."owner" and "full_name" != $2) as obj where obj is not null) as "owner" from "teams" where CAST ("name" AS text) = $3) as "tmp" where "tmp"."owner" is not null`
  );
});
