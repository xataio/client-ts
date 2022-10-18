import { execSync } from 'child_process';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataApiClient } from '../../packages/client/src';
import { getCurrentBranchName } from '../../packages/client/src/util/config';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let api: XataApiClient;
let workspace: string;
let database: string;
let hooks: TestEnvironmentResult['hooks'];
let fetch: TestEnvironmentResult['clientOptions']['fetch'];

let branchOptions: {
  apiKey: string;
  databaseURL: string;
  fetchImpl: TestEnvironmentResult['clientOptions']['fetch'];
};

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('branches');

  api = result.api;
  hooks = result.hooks;
  workspace = result.workspace;
  database = result.database;
  fetch = result.clientOptions.fetch;

  branchOptions = {
    apiKey: result.clientOptions.apiKey,
    databaseURL: result.clientOptions.databaseURL,
    fetchImpl: result.clientOptions.fetch
  };

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

describe('getBranch', () => {
  const envValues = { ...process.env };
  const gitBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

  afterAll(() => {
    // Reset env variable values
    process.env = envValues;
  });

  test('uses an env variable if it is set', async () => {
    const branch = 'using-env-variable';

    await api.branches.createBranch({ workspace, database, branch });

    process.env = { NODE_ENV: 'development', XATA_BRANCH: branch };
    expect(await getCurrentBranchName(branchOptions)).toEqual(branch);

    process.env = { NODE_ENV: 'development', VERCEL_GIT_COMMIT_REF: branch };
    expect(await getCurrentBranchName(branchOptions)).toEqual(branch);

    process.env = { NODE_ENV: 'development', CF_PAGES_BRANCH: branch };
    expect(await getCurrentBranchName(branchOptions)).toEqual(branch);

    process.env = { NODE_ENV: 'development', BRANCH: branch };
    expect(await getCurrentBranchName(branchOptions)).toEqual(branch);
  });

  test('uses `main` if no env variable is set is not set and there is not associated git branch', async () => {
    process.env = { NODE_ENV: 'development' };
    const branch = await getCurrentBranchName(branchOptions);

    expect(branch).toEqual('main');
  });

  test('uses the git branch name if branch exists', async () => {
    process.env = { NODE_ENV: 'development' };
    if (gitBranch) {
      try {
        await api.branches.createBranch({ workspace, database, branch: gitBranch });
      } catch (e) {
        // If the branch already exists, ignore the error
      }

      fetch.mockClear();

      const branch = await getCurrentBranchName(branchOptions);

      expect(branch).toEqual(gitBranch);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0].toString().endsWith(`/resolveBranch?gitBranch=${gitBranch}`)).toBeTruthy();
    }
  });

  test('Strips null values from qs', async () => {
    fetch.mockClear();

    const resolveBranch = await api.branches.resolveBranch({
      workspace,
      database,
      // @ts-expect-error
      gitBranch: null,
      // @ts-expect-error
      fallbackBranch: null
    });

    expect(resolveBranch).toMatchInlineSnapshot(`
      {
        "branch": "main",
        "reason": {
          "code": "DEFAULT_BRANCH",
          "message": "Default branch for this database",
        },
      }
    `);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0].toString().endsWith('/resolveBranch')).toBeTruthy();
  });

  test('getBranch method retruns runtime branch', async () => {
    const client = new XataClient({
      databaseURL: branchOptions.databaseURL,
      branch: 'foo',
      apiKey: branchOptions.apiKey,
      fetch: branchOptions.fetchImpl
    });

    const { databaseURL, branch } = await client.getConfig();

    expect(branch).toEqual('foo');
    expect(databaseURL).toEqual(branchOptions.databaseURL);
  });
});
