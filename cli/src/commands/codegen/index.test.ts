import { Config } from '@oclif/core';
import { mkdir, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import Codegen from './index.js';

vi.mock('node-fetch');
vi.mock('fs/promises');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const mkdirMock = mkdir as unknown as ReturnType<typeof vi.fn>;
const writeFileMock = writeFile as unknown as ReturnType<typeof vi.fn>;

describe('codegen', () => {
  test('fails if the output filepath is not provided', async () => {
    const config = await Config.load();
    const command = new Codegen([], config as Config);
    command.userConfig = {};

    await expect(command.run()).rejects.toMatchInlineSnapshot(
      '[Error: Please, specify an output file as an argument or configure it in your config file]'
    );
  });

  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });

    const config = await Config.load();
    const command = new Codegen(['xata.ts'], config as Config);
    process.env.XATA_DATABASE_URL = 'https://test-r5vcv5.xata.sh/db/test';

    await expect(command.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-r5vcv5.xata.sh/db/test:main');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');
  });

  test.each([['js'], ['ts']])('generates code with extension = %o', async (ext) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({
        schema: {
          tables: []
        }
      })
    });

    const config = await Config.load();
    const command = new Codegen([`src/xata.${ext}`], config as Config);
    process.env.XATA_DATABASE_URL = 'https://test-r5vcv5.xata.sh/db/test';

    const log = vi.spyOn(command, 'log');

    await command.run();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-r5vcv5.xata.sh/db/test:main');
    expect(fetchMock.mock.calls[0][1].method).toEqual('GET');

    expect(mkdirMock).toHaveBeenCalledOnce();
    expect(mkdirMock.mock.calls[0][0]).toEqual('src');
    expect(mkdirMock.mock.calls[0][1]).toEqual({ recursive: true });

    expect(writeFileMock).toHaveBeenCalledTimes(ext === 'js' ? 2 : 1);
    expect(writeFileMock.mock.calls[0][0]).toEqual(`src/xata.${ext}`);
    if (ext === 'js') {
      expect(writeFileMock.mock.calls[1][0]).toEqual('src/types.d.ts');
    }

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toEqual(`Your XataClient is generated at ./src/xata.${ext}`);
  });
});
