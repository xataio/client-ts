import { Config } from '@oclif/core';
import { writeFile } from 'fs/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SetConfig from './set.js';

vi.mock('fs/promises');

afterEach(() => {
  vi.clearAllMocks();
});

const writeFileMock = writeFile as unknown as ReturnType<typeof vi.fn>;

describe('set config', () => {
  test('fails if there is not project configuration', async () => {
    const config = await Config.load();
    const command = new SetConfig(['foo', 'bar'], config);

    await expect(command.run()).rejects.toMatchInlineSnapshot(
      '[Error: No project configuration found. Use xata init to configure your project.]'
    );
  });

  test('fails if the key does not exist in the schema definition', async () => {
    const config = await Config.load();
    const command = new SetConfig(['foo', 'bar'], config);
    command.projectConfig = {};

    await expect(command.run()).rejects.toThrow('Unknown path "foo"');
  });

  test('fails if the key points to an object', async () => {
    const config = await Config.load();
    const command = new SetConfig(['codegen', 'bar'], config);
    command.projectConfig = {};

    await expect(command.run()).rejects.toThrow('Cannot set value at path "codegen" because it is an object');
  });

  test('updates a configuration key', async () => {
    const config = await Config.load();
    const command = new SetConfig(['codegen.output', 'src/xata.ts'], config);
    command.projectConfig = {};
    command.projectConfigLocation = '.xatarc.json';

    await command.run();

    expect(writeFileMock).toHaveBeenCalledOnce();
    expect(writeFileMock.mock.calls[0][0]).toEqual('.xatarc.json');
    expect(writeFileMock.mock.calls[0][1]).toEqual(JSON.stringify({ codegen: { output: 'src/xata.ts' } }, null, 2));
  });
});
