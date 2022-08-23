import { execSync } from 'child_process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { BaseClientOptions, FetchImpl, XataApiClient } from '../../packages/client/src';
import { getCurrentBranchName } from '../../packages/client/src/util/config';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let api: XataApiClient;
let workspace: string;
let database: string;
let cleanup: () => Promise<void>;
let fetch: TestEnvironmentResult['clientOptions']['fetch'];

let getBranchOptions: {
  apiKey: string;
  databaseURL: string;
  fetchImpl: TestEnvironmentResult['clientOptions']['fetch'];
};

beforeAll(async () => {
  const result = await setUpTestEnvironment('branches');

  api = result.api;
  cleanup = result.cleanup;
  workspace = result.workspace;
  database = result.database;
  fetch = result.clientOptions.fetch;

  getBranchOptions = {
    apiKey: result.clientOptions.apiKey,
    databaseURL: result.clientOptions.databaseURL,
    fetchImpl: result.clientOptions.fetch
  };
});

afterAll(async () => {
  await cleanup();
});

describe('getBranch', () => {
  const envValues = { ...process.env };
  const gitBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

  afterAll(() => {
    // Reset env variable values
    process.env = envValues;
  });

  test('uses an env variable if it is set', async () => {
    const branchName = 'using-env-variable';

    await api.branches.createBranch(workspace, database, branchName);

    process.env = { NODE_ENV: 'development', XATA_BRANCH: branchName };
    expect(await getCurrentBranchName(getBranchOptions)).toEqual(branchName);

    process.env = { NODE_ENV: 'development', VERCEL_GIT_COMMIT_REF: branchName };
    expect(await getCurrentBranchName(getBranchOptions)).toEqual(branchName);

    process.env = { NODE_ENV: 'development', CF_PAGES_BRANCH: branchName };
    expect(await getCurrentBranchName(getBranchOptions)).toEqual(branchName);

    process.env = { NODE_ENV: 'development', BRANCH: branchName };
    expect(await getCurrentBranchName(getBranchOptions)).toEqual(branchName);
  });

  test('uses `main` if no env variable is set is not set and there is not associated git branch', async () => {
    process.env = { NODE_ENV: 'development' };
    const branch = await getCurrentBranchName(getBranchOptions);

    expect(branch).toEqual('main');
  });

  test('uses the git branch name if branch exists', async () => {
    process.env = { NODE_ENV: 'development' };
    if (gitBranch) {
      await api.branches.createBranch(workspace, database, gitBranch);

      fetch.mockClear();

      const branch = await getCurrentBranchName(getBranchOptions);

      expect(branch).toEqual(gitBranch);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0].toString().endsWith(`/resolveBranch?gitBranch=${gitBranch}`)).toBeTruthy();
    }
  });

  test('Strips null and undefined values from qs', async () => {
    fetch.mockClear();

    // @ts-expect-error
    const resolveBranch = await api.databases.resolveBranch(workspace, database, undefined, null);

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
      databaseURL: getBranchOptions.databaseURL,
      branch: 'foo',
      apiKey: getBranchOptions.apiKey,
      fetch: getBranchOptions.fetchImpl
    });

    const { databaseURL, branch } = await client.getConfig();

    expect(branch).toEqual('foo');
    expect(databaseURL).toEqual(getBranchOptions.databaseURL);
  });
});
