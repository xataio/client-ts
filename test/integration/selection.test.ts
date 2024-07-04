import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { BaseClient, XataApiClient } from '../../packages/client/src';
import { XataClient } from '../../packages/codegen/example/xata';
import { animalUsers, fruitUsers, ownerAnimals, ownerFruits } from '../mock_data';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let api: XataApiClient;
let baseClient: BaseClient;
let workspace: string;
let region: string;
let database: string;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('query');

  xata = result.client;
  api = result.api;
  baseClient = result.baseClient;
  workspace = result.workspace;
  region = result.region;
  database = result.database;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  const { xata_id: ownerAnimalsId } = await xata.db.users.create(ownerAnimals);
  const { xata_id: ownerFruitsId } = await xata.db.users.create(ownerFruits);

  const fruitsTeam = await xata.db.teams.create({
    name: 'Team fruits',
    labels: ['apple', 'banana', 'orange'],
    owner: ownerFruitsId,
    index: 1
  });

  const animalsTeam = await xata.db.teams.create({
    name: 'Team animals',
    labels: ['monkey', 'lion', 'eagle', 'dolphin'],
    owner: ownerAnimalsId
  });

  await xata.db.teams.create({
    name: 'Mixed team fruits & animals',
    labels: ['monkey', 'banana', 'apple', 'dolphin']
  });

  await xata.db.users.create([
    ...animalUsers.map((item) => ({ ...item, team: animalsTeam })),
    ...fruitUsers.map((item) => ({ ...item, team: fruitsTeam }))
  ]);
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

describe('integration tests', () => {
  test('foreign keys not expanded by default', async () => {
    const teams = await xata.db.teams.filter('name', 'Team fruits').getFirst({
      columns: ['owner', 'xata_id']
    });
    expect(teams).toBeDefined();
    expect(teams?.owner).toBeDefined();
    expect(teams?.owner.full_name).toBeUndefined();
    expect(teams?.owner.email).toBeUndefined();
    expect(teams?.xata_id).toBeDefined();
  });
  test('foreign keys brought back with .*', async () => {
    const teams = await xata.db.teams.filter('name', 'Team fruits').getFirst({
      columns: ['owner.*', 'xata_id']
    });
    expect(teams).toBeDefined();
    expect(teams?.owner).toBeDefined();
    expect(teams?.owner.full_name).toBeDefined();
    expect(teams?.owner.email).toBeDefined();
    expect(teams?.xata_id).toBeDefined();
  });
  // TODO just name of foreign key should not be possible in types
  test('foreign keys are null objects if no record matches', async () => {
    const teams = await xata.db.teams.filter('name', 'Team fruits').getFirst({
      columns: ['pet', 'xata_id']
    });
    expect(teams).toBeDefined();
    expect(teams?.pet).toBeNull();

    const teams2 = await xata.db.teams.filter('name', 'Team fruits').getFirst({
      columns: ['pet.xata_id', 'xata_id']
    });
    expect(teams2).toBeDefined();
    expect(teams2?.pet).toBeNull();
    expect(teams2?.pet?.xata_id).toBeUndefined();
    const teams3 = await xata.db.teams.filter('name', 'Team fruits').getFirst({
      columns: ['pet.*', 'xata_id']
    });
    expect(teams3).toBeDefined();
    expect(teams3?.pet).toBeNull();
  });
  test('specific foreign key fields are fetched', async () => {
    const teams = await xata.db.teams.filter('name', 'Team fruits').getFirst({
      columns: ['owner.full_name', 'xata_id', 'owner.email', 'pet.*']
    });
    expect(teams).toBeDefined();
    expect(teams?.owner).toBeDefined();
    expect(teams?.owner.full_name).toBeDefined();
    expect(teams?.owner.email).toBeDefined();
    expect(teams?.owner.xata_id).toBeDefined();
    expect(teams?.xata_id).toBeDefined();
    expect(teams?.pet).toBeNull();
  });
  test.todo('combination of * and .field');
});
