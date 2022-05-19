import { Config } from '@oclif/core';
import { expect, test } from 'vitest';
import BranchesList from './list.js';

test('branches list', async () => {
  const config = await Config.load();
  const list = new BranchesList([], config as Config);

  await expect(list.run()).rejects.toThrow('To be done');
});
