import { Config } from '@oclif/core';
import { afterEach, describe, expect, test, vi } from 'vitest';
import GetConfig from './get.js';

vi.mock('fs/promises');

afterEach(() => {
  vi.clearAllMocks();
});

describe('get config', () => {
  test('fails if there is not project configuration', async () => {
    const config = await Config.load();
    const command = new GetConfig(['foo'], config);

    await expect(command.run()).rejects.toMatchInlineSnapshot(
      '[Error: No project configuration found. Use xata init to configure your project.]'
    );
  });

  test('fails if the key points to an object', async () => {
    const config = await Config.load();
    const command = new GetConfig(['codegen'], config);
    command.projectConfig = { codegen: {} };

    await expect(command.run()).rejects.toThrow('Key found but it is an object');
  });

  test('returns a value', async () => {
    const config = await Config.load();
    const command = new GetConfig(['codegen.output'], config);
    command.projectConfig = { codegen: { output: 'src/xata.ts' } };

    const log = vi.spyOn(command, 'log');

    await command.run();

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toEqual('src/xata.ts');
  });
});
