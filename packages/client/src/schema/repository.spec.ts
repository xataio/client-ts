import { expect, test } from 'vitest';
import { KyselyPlugin } from '../kysely';
import { columnSelectionObject, generateSelectStatement } from './repository';

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
  const db = new KyselyPlugin().build({
    apiKey: 'dummyApiKey',
    apiUrl: '',
    branch: 'main',
    fetch: {} as any,
    host: 'staging',
    schema: {} as any,
    trace: {} as any,
    workspacesApiUrl: 'https://dummy-workspace.eu-west-1.staging-xata.dev/db/dummy-database'
  });
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
