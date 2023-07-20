import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';
import { animalUsers, fruitUsers, ownerAnimals, ownerFruits } from '../mock_data';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('query');

  xata = result.client;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  const { id: ownerAnimalsId } = await xata.db.users.create(ownerAnimals);
  const { id: ownerFruitsId } = await xata.db.users.create(ownerFruits);

  const fruitsTeam = await xata.db.teams.create({
    name: 'Team fruits',
    labels: ['apple', 'banana', 'orange'],
    owner: ownerFruitsId
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

describe('ask questions', () => {
  test('ask a question', async () => {
    const result = await xata.db.teams.ask("What's your names?");

    expect(result).toBe('Team animals');
  });
});
