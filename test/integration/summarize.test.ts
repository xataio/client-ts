import { afterAll, afterEach, beforeAll, beforeEach, describe } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('summarize');

  xata = result.client;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  const [pet1, pet2, pet3] = await xata.db.pets.create([
    { name: 'Otis', type: 'dog', num_legs: 4 },
    { name: 'Toffee', type: 'cat', num_legs: 4 },
    { name: 'Lyra', type: 'dog', num_legs: 3 }
  ]);

  await xata.db.users.create([
    { full_name: 'A', name: 'A', index: 10, rating: 10.5, settings: { plan: 'paid', dark: true }, pet: pet1.id },
    { full_name: 'B', name: 'B', index: 10, rating: 10.5, settings: { plan: 'free' }, pet: pet2.id },
    { full_name: 'C', name: 'C', index: 30, rating: 40.0, settings: { plan: 'paid' }, pet: pet3.id }
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

//describe('summarize', () => {});
