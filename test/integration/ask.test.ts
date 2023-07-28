import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { BaseClient } from '../../packages/client';
import { TestEnvironmentResult, setUpTestEnvironment } from '../utils/setup';
import fetch from 'cross-fetch';

const xata = new BaseClient({
  databaseURL: 'https://xata-uq2d57.eu-west-1.xata.sh/db/docs',
  fetch
});

let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('search');

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

describe('ask questions', () => {
  test('ask a question', async () => {
    const result = await xata.db.search.ask(`My name is Alexis. What is Xata?`);
    expect(result).toBeDefined();
    expect(typeof result.answer).toBe('string');
    expect(typeof result.sessionId).toBe('string');
    expect(result.records).toBeDefined();
    expect(result.records?.length).toBeGreaterThan(0);

    const result2 = await xata.db.search.ask(`What's my name?`, { sessionId: result.sessionId });
    expect(result2).toBeDefined();
    expect(typeof result2.answer).toBe('string');
  });
});
