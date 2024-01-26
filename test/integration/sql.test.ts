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

    const { records, warning, columns } = await xata.sql<TeamsRecord>`SELECT * FROM teams WHERE id = ${team.id}`;

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
        "id": {
          "type_name": "text",
        },
        "index": {
          "type_name": "int8",
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
        "xata.createdAt": {
          "type_name": "timestamptz",
        },
        "xata.updatedAt": {
          "type_name": "timestamptz",
        },
        "xata.version": {
          "type_name": "int4",
        },
      }
    `);

    expect(records[0].id).toBe(team.id);
    expect(records[0].name).toBe('Team ships');
  });

  test('read multiple teams ', async () => {
    const teams = await xata.db.teams.create([{ name: '[A] Cars' }, { name: '[A] Planes' }]);

    const { records, warning, columns } = await xata.sql<TeamsRecord>("SELECT * FROM teams WHERE name LIKE '[A] %'");

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
        "id": {
          "type_name": "text",
        },
        "index": {
          "type_name": "int8",
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
        "xata.createdAt": {
          "type_name": "timestamptz",
        },
        "xata.updatedAt": {
          "type_name": "timestamptz",
        },
        "xata.version": {
          "type_name": "int4",
        },
      }
    `);

    const record1 = records.find((record) => record.id === teams[0].id);
    const record2 = records.find((record) => record.id === teams[1].id);

    expect(record1).toBeDefined();
    expect(record1?.name).toBe('[A] Cars');
    expect(record2).toBeDefined();
    expect(record2?.name).toBe('[A] Planes');
  });

  test('create team', async () => {
    const { records, warning, columns } = await xata.sql<TeamsRecord>({
      statement: `INSERT INTO teams (name) VALUES ($1) RETURNING *`,
      params: ['Team ships 2']
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
        "id": {
          "type_name": "text",
        },
        "index": {
          "type_name": "int8",
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
        "xata.createdAt": {
          "type_name": "timestamptz",
        },
        "xata.updatedAt": {
          "type_name": "timestamptz",
        },
        "xata.version": {
          "type_name": "int4",
        },
      }
    `);

    expect(warning).toBeUndefined();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Team ships 2');

    const team = await xata.db.teams.read(records[0].id);
    expect(team).toBeDefined();
    expect(team?.name).toBe('Team ships 2');
  });
});
