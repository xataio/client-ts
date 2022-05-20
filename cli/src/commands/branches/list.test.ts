import { Config } from '@oclif/core';
import { describe, expect, test } from 'vitest';
import BranchesList from './list.js';

describe('branches list', () => {
  test('fails if no workspace id can be found', async () => {
    const config = await Config.load();
    const list = new BranchesList([], config as Config);

    await expect(list.run()).rejects.toThrow(
      'Could not find workspace id. Please set XATA_DATABASE_URL or use the --workspace flag.'
    );
  });
});
