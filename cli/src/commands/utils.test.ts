import { afterAll, beforeEach, test } from 'vitest';

export function clearEnvVariables() {
  const env = { ...process.env };

  beforeEach(() => {
    process.env = {};
  });

  afterAll(() => {
    process.env = env;
  });
}

test('nothing', () => {
  // nothing
});
