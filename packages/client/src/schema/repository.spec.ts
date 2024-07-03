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
  tables: {
    ['teams']: {
      foreignKeys: teamsForeignKeys
    },
    ['users']: {
      foreignKeys: usersForeignKeys
    }
  }
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
  console.log('res', JSON.stringify(res));
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
    primaryKey: 'xata_id',
    stmt: statement,
    tableName
  }) as any;

  expect(statement.compile().sql).toBe(
    `select "xata_id", "name", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet") as obj) as "pet" from "users" where "xata_id" = "teams"."owner") as obj) as "owner" from "teams"`
  );
});

test('link selection to kysely selects with filter', () => {
  const columns = ['name', 'owner.pet.*', 'owner.full_name', 'xata_id'];
  const db = new KyselyPlugin().build(clientOptions);
  const tableName = 'teams';
  let statement = db.selectFrom(tableName);

  const filter = {
    topLevelProp1: 'Team animals',
    topLevelProp2: 1,
    owner: {
      full_name: { $not: 'John Doe' },
      pet: {
        thirdLevelProp1: 'Dog',
        name: {
          $contains: ['one', 'two'],
          $not: 'thirdlevelPropagain'
        },
        thirdLevelProp2: 'Dog2'
      },
      ownerProp: {
        $is: 10
      }
    },
    topLevelProp3: ''
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
    `select * from (select "xata_id", "name", (select to_json(obj) from (select "xata_id", "full_name", (select to_json(obj) from (select * from "pets" where "xata_id" = "users"."pet" and (CAST ("thirdLevelProp1" AS text) = $1 and (((position($2 IN "name"::text)>0) and (position($3 IN "name"::text)>0)) and not CAST ("name" AS text) = $4) and CAST ("thirdLevelProp2" AS text) = $5)) as obj where obj is not null) as "pet" from "users" where "xata_id" = "teams"."owner" and (not CAST ("full_name" AS text) = $6 and "ownerProp" = $7)) as obj where obj is not null) as "owner" from "teams" where (CAST ("topLevelProp1" AS text) = $8 and "topLevelProp2" = $9 and CAST ("topLevelProp3" AS text) = $10)) as "tmp" where "tmp"."owner" is not null`
  );
});
