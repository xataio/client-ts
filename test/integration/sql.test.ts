import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { TeamsRecord, XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('sql');

  xata = result.client;
  hooks = result.hooks;

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

describe('SQL proxy', () => {
  test('read single team with id', async () => {
    const team = await xata.db.teams.create({ name: 'Team ships' });

    const { records, warning, columns } =
      await xata.sql<TeamsRecord>`SELECT * FROM teams WHERE xata_id = ${team.xata_id}`;

    expect(warning).toBeUndefined();
    expect(records).toHaveLength(1);

    expect(columns).toMatchInlineSnapshot(`
      {
        "config": {
          "type_name": "jsonb",
        },
        "dark": {
          "type_name": "bool",
        },
        "description": {
          "type_name": "text",
        },
        "email": {
          "type_name": "text",
        },
        "founded_date": {
          "type_name": "timestamptz",
        },
        "index": {
          "type_name": "int4",
        },
        "labels": {
          "type_name": "_text",
        },
        "name": {
          "type_name": "text",
        },
        "owner": {
          "type_name": "text",
        },
        "plan": {
          "type_name": "text",
        },
        "rating": {
          "type_name": "float8",
        },
        "xata_createdat": {
          "type_name": "timestamptz",
        },
        "xata_id": {
          "type_name": "text",
        },
        "xata_updatedat": {
          "type_name": "timestamptz",
        },
        "xata_version": {
          "type_name": "int4",
        },
      }
    `);

    expect(records[0].xata_id).toBe(team.xata_id);
    expect(records[0].name).toBe('Team ships');
  });

  test('read multiple teams ', async () => {
    const teams = await xata.db.teams.create([{ name: '[A] Cars' }, { name: '[A] Planes' }]);

    const { records, warning, columns } = await xata.sql<TeamsRecord>`SELECT * FROM teams WHERE name LIKE '[A] %'`;

    expect(warning).toBeUndefined();
    expect(records).toHaveLength(2);

    expect(columns).toMatchInlineSnapshot(`
      {
        "config": {
          "type_name": "jsonb",
        },
        "dark": {
          "type_name": "bool",
        },
        "description": {
          "type_name": "text",
        },
        "email": {
          "type_name": "text",
        },
        "founded_date": {
          "type_name": "timestamptz",
        },
        "index": {
          "type_name": "int4",
        },
        "labels": {
          "type_name": "_text",
        },
        "name": {
          "type_name": "text",
        },
        "owner": {
          "type_name": "text",
        },
        "plan": {
          "type_name": "text",
        },
        "rating": {
          "type_name": "float8",
        },
        "xata_createdat": {
          "type_name": "timestamptz",
        },
        "xata_id": {
          "type_name": "text",
        },
        "xata_updatedat": {
          "type_name": "timestamptz",
        },
        "xata_version": {
          "type_name": "int4",
        },
      }
    `);

    const record1 = records.find((record) => record.xata_id === teams[0].xata_id);
    const record2 = records.find((record) => record.xata_id === teams[1].xata_id);

    expect(record1).toBeDefined();
    expect(record1?.name).toBe('[A] Cars');
    expect(record2).toBeDefined();
    expect(record2?.name).toBe('[A] Planes');
  });

  test('create team', async () => {
    const { records, warning, columns } = await xata.sql<TeamsRecord>({
      statement: `INSERT INTO teams (xata_id, name) VALUES ($1, $2) RETURNING *`,
      params: ['my-id', 'Team ships 2']
    });

    expect(columns).toMatchInlineSnapshot(`
      {
        "config": {
          "type_name": "jsonb",
        },
        "dark": {
          "type_name": "bool",
        },
        "description": {
          "type_name": "text",
        },
        "email": {
          "type_name": "text",
        },
        "founded_date": {
          "type_name": "timestamptz",
        },
        "index": {
          "type_name": "int4",
        },
        "labels": {
          "type_name": "_text",
        },
        "name": {
          "type_name": "text",
        },
        "owner": {
          "type_name": "text",
        },
        "plan": {
          "type_name": "text",
        },
        "rating": {
          "type_name": "float8",
        },
        "xata_createdat": {
          "type_name": "timestamptz",
        },
        "xata_id": {
          "type_name": "text",
        },
        "xata_updatedat": {
          "type_name": "timestamptz",
        },
        "xata_version": {
          "type_name": "int4",
        },
      }
    `);

    expect(warning).toBeUndefined();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Team ships 2');

    const team = await xata.db.teams.read(records[0].xata_id);
    expect(team).toBeDefined();
    expect(team?.name).toBe('Team ships 2');
  });

  test("calling xata.sql as a function throws an error because it's not safe", async () => {
    // @ts-expect-error - Testing invalid usage
    await expect(xata.sql('SELECT * FROM teams')).rejects.toThrow(
      'Invalid usage of `xata.sql`. Please use it as a tagged template or with an object.'
    );
  });

  test('calling xata.sql with invalid prepared statement', async () => {
    const order = 'ASC';
    await expect(xata.sql<TeamsRecord>`SELECT * FROM teams ORDER BY name ${order}`).rejects.toThrow(
      'invalid SQL: unused parameters: used 0 of 1 parameters'
    );
  });

  test("calling xata.sql with invalid prepared statement doesn't throw an error when bypassing prepared statement protection", async () => {
    const order = 'ASC';
    const { records } = await xata.sql<TeamsRecord>({
      statement: `SELECT * FROM teams ORDER BY name ${order}`
    });
    expect(records).toBeDefined();
  });
});
