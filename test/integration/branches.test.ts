import { execSync } from 'child_process';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { XataApiClient } from '../../packages/client/src';
import { getCurrentBranchName } from '../../packages/client/src/util/config';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.envrc') });

let databaseName: string;

const apiKey = process.env.XATA_API_KEY ?? '';
const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const api = new XataApiClient({ apiKey, fetch });

beforeAll(async () => {
  const id = Math.round(Math.random() * 100000);

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-branches-${id}`);
  databaseName = database.databaseName;
});

afterAll(async () => {
  await api.databases.deleteDatabase(workspace, databaseName);
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

    await api.branches.createBranch(workspace, databaseName, branchName);

    const getBranchOptions = {
      apiKey,
      databaseURL: `https://${workspace}.xata.sh/db/${databaseName}`,
      fetchImpl: fetch
    };

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
    const branch = await getCurrentBranchName({
      apiKey,
      databaseURL: `https://${workspace}.xata.sh/db/${databaseName}`,
      fetchImpl: fetch
    });

    expect(branch).toEqual('main');
  });

  test('uses the git branch name if branch exists', async () => {
    process.env = { NODE_ENV: 'development' };

    await api.branches.createBranch(workspace, databaseName, gitBranch);

    const branch = await getCurrentBranchName({
      apiKey,
      databaseURL: `https://${workspace}.xata.sh/db/${databaseName}`,
      fetchImpl: fetch
    });

    expect(branch).toEqual(gitBranch);
  });
});
