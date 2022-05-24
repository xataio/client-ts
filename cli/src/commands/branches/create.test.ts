import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as git from '../../git.js';
import { clearEnvVariables } from '../utils.test.js';
import BranchesCreate from './create.js';

vi.mock('node-fetch');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
});

afterEach(() => {
  vi.clearAllMocks();
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('branches create', () => {
  test('fails if the workspace id is not provided', async () => {
    const config = await Config.load();
    const list = new BranchesCreate([], config as Config);

    await expect(list.run()).rejects.toMatchInlineSnapshot(`
      [Error: Missing 1 required arg:
      branch  The new branch name
      See more help with --help]
    `);
  });

  test('fails if the database name is not provided', async () => {
    const config = await Config.load();
    const list = new BranchesCreate(['--workspace', 'test-1234'], config as Config);

    await expect(list.run()).rejects.toMatchInlineSnapshot(`
      [Error: Missing 1 required arg:
      branch  The new branch name
      See more help with --help]
    `);
  });

  test('fails if the branch name is not provided', async () => {
    const config = await Config.load();
    const list = new BranchesCreate(['--workspace', 'test-1234', '--database', 'test'], config as Config);

    await expect(list.run()).rejects.toMatchInlineSnapshot(`
      [Error: Missing 1 required arg:
      branch  The new branch name
      See more help with --help]
    `);
  });

  test('fails if the HTTP response is not ok', async () => {
    fetchMock.mockReturnValue({
      ok: false,
      json: async () => ({
        message: 'Something went wrong'
      })
    });

    const config = await Config.load();
    const list = new BranchesCreate(
      ['--workspace', 'test-1234', '--database', 'test', 'featureA', '--no-git'],
      config as Config
    );

    await expect(list.run()).rejects.toThrow('Something went wrong');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/db/test:featureA?from=');
    expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');
  });

  test.each([[false], [true]])('performs the creation with JSON enabled = %o and no git integration', async (json) => {
    fetchMock.mockReturnValue({
      ok: true,
      json: async () => ({})
    });

    const config = await Config.load();
    const list = new BranchesCreate(
      ['--workspace', 'test-1234', '--database', 'test', 'featureA', '--no-git'],
      config as Config
    );

    expect(BranchesCreate.enableJsonFlag).toBe(true);
    vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

    const log = vi.spyOn(list, 'log');

    const result = await list.run();

    if (json) {
      expect(result).toMatchInlineSnapshot('{}');
    } else {
      expect(result).toBeUndefined();
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/db/test:featureA?from=');
    expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');

    expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

    if (!json) {
      expect(log.mock.calls[0][0]).toEqual('Branch featureA successfully created');
    }
  });

  test('fails if git is not installed', async () => {
    vi.spyOn(git, 'isGitInstalled').mockReturnValue(false);

    const config = await Config.load();
    const list = new BranchesCreate(['--workspace', 'test-1234', '--database', 'test', 'featureA'], config as Config);

    await expect(list.run()).rejects.toThrow(
      'Git cannot be found. Please install it or use the --no-git flag to disable integrating xata branches with git branches.'
    );
  });

  test('fails if the working directory is not clean', async () => {
    vi.spyOn(git, 'isGitInstalled').mockReturnValue(true);
    vi.spyOn(git, 'isWorkingDirClean').mockReturnValue(false);

    const config = await Config.load();
    const list = new BranchesCreate(['--workspace', 'test-1234', '--database', 'test', 'featureA'], config as Config);

    await expect(list.run()).rejects.toThrow(
      'The working directory has uncommited changes. Please commit or stash them before creating a branch. Or use the --no-git flag to disable integrating xata branches with git branches.'
    );
  });

  test('fails if the working directory is not a git repository', async () => {
    vi.spyOn(git, 'isGitInstalled').mockReturnValue(true);
    vi.spyOn(git, 'isWorkingDirClean').mockImplementation(() => {
      throw new Error('fatal. not a git repository');
    });

    const config = await Config.load();
    const list = new BranchesCreate(['--workspace', 'test-1234', '--database', 'test', 'featureA'], config as Config);

    await expect(list.run()).rejects.toThrow(
      'The working directory is not under git version control. Please initialize or clone a git repository or use the --no-git flag to disable integrating xata branches with git branches.'
    );
  });

  test.each([[false], [true]])(
    'creates a branch with JSON enabled = %o, git integration and no base branch',
    async (json) => {
      vi.spyOn(git, 'isGitInstalled').mockReturnValue(true);
      vi.spyOn(git, 'isWorkingDirClean').mockReturnValue(true);
      vi.spyOn(git, 'defaultGitBranch').mockReturnValue('def');
      const createBranch = vi.spyOn(git, 'createBranch').mockReturnValue(undefined);

      const config = await Config.load();
      const list = new BranchesCreate(['--workspace', 'test-1234', '--database', 'test', 'featureA'], config as Config);

      expect(BranchesCreate.enableJsonFlag).toBe(true);
      vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

      const log = vi.spyOn(list, 'log');

      const result = await list.run();

      if (json) {
        expect(result).toMatchInlineSnapshot('{}');
      } else {
        expect(result).toBeUndefined();
      }

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/db/test:featureA?from=');
      expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');

      expect(createBranch).toHaveBeenCalledOnce();
      expect(createBranch.mock.calls[0][0]).toEqual('featureA');
      expect(createBranch.mock.calls[0][1]).toEqual('def');

      expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

      if (!json) {
        expect(log.mock.calls[0][0]).toEqual(
          'Branch featureA successfully created. A new git branch with the same name has been created and is your current branch.'
        );
      }
    }
  );

  test.each([[false], [true]])(
    'creates a branch with JSON enabled = %o, git integration and base branch',
    async (json) => {
      vi.spyOn(git, 'isGitInstalled').mockReturnValue(true);
      vi.spyOn(git, 'isWorkingDirClean').mockReturnValue(true);
      vi.spyOn(git, 'defaultGitBranch').mockReturnValue('def');
      const createBranch = vi.spyOn(git, 'createBranch').mockReturnValue(undefined);

      const config = await Config.load();
      const list = new BranchesCreate(
        ['--workspace', 'test-1234', '--database', 'test', 'featureA', '--from', 'base'],
        config as Config
      );

      expect(BranchesCreate.enableJsonFlag).toBe(true);
      vi.spyOn(list, 'jsonEnabled').mockReturnValue(json);

      const log = vi.spyOn(list, 'log');

      const result = await list.run();

      if (json) {
        expect(result).toMatchInlineSnapshot('{}');
      } else {
        expect(result).toBeUndefined();
      }

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toEqual('https://test-1234.xata.sh/db/test:featureA?from=base');
      expect(fetchMock.mock.calls[0][1].method).toEqual('PUT');

      expect(createBranch).toHaveBeenCalledOnce();
      expect(createBranch.mock.calls[0][0]).toEqual('featureA');
      expect(createBranch.mock.calls[0][1]).toEqual('base');

      expect(log).toHaveBeenCalledTimes(json ? 0 : 1);

      if (!json) {
        expect(log.mock.calls[0][0]).toEqual(
          'Branch featureA successfully created. A new git branch with the same name has been created and is your current branch.'
        );
      }
    }
  );
});
