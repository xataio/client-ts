import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { XataApiClient } from '../client/src';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.envrc') });

const client = new XataApiClient({
  fetch,
  apiKey: process.env.XATA_API_KEY || ''
});

// Integration tests take longer than unit tests, increasing the timeout
jest.setTimeout(50000);

describe('API Client Integration Tests', () => {
  test('Create, get and delete workspace', async () => {
    const workspace = await client.workspaces.createWorkspace({
      name: 'foo',
      slug: 'foo'
    });

    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe('foo');

    const foo = await client.workspaces.getWorkspace(workspace.id);
    expect(foo.id).toBe(workspace.id);
    expect(foo.slug).toBe('foo');

    await client.workspaces.deleteWorkspace(workspace.id);

    // Disabled until fixed: https://github.com/xataio/xata/issues/647
    // await expect(client.workspaces.getWorkspace(workspace.id)).rejects.toMatchInlineSnapshot();
  });
});
