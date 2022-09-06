import { Context, context, Span, trace as traceAPI } from '@opentelemetry/api';
import realFetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { File, Suite, TestContext, vi } from 'vitest';
import { BaseClient, CacheImpl, XataApiClient } from '../../packages/client/src';
import { getHostUrl, HostProvider, isHostProviderAlias } from '../../packages/client/src/api/providers';
import { TraceAttributes, TraceFunction } from '../../packages/client/src/schema/tracing';
import { XataClient } from '../../packages/codegen/example/xata';
import { schema } from '../mock_data';
import { setupTracing } from './tracing';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const apiKey = process.env.XATA_API_KEY ?? '';
if (apiKey === '') throw new Error('XATA_API_KEY environment variable is not set');

const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const host = getProvider(process.env.XATA_API_PROVIDER);
const fetch = vi.fn(realFetch);

export type EnvironmentOptions = {
  cache?: CacheImpl;
};

export type TestEnvironmentResult = {
  api: XataApiClient;
  client: XataClient;
  baseClient: BaseClient;
  database: string;
  workspace: string;
  clientOptions: {
    databaseURL: string;
    fetch: typeof fetch;
    apiKey: string;
    branch: string;
    cache?: CacheImpl;
  };
  hooks: {
    beforeAll: (ctx: Suite | File) => Promise<void>;
    afterAll: (ctx: Suite | File) => Promise<void>;
    beforeEach: (ctx: TestContext) => Promise<void>;
    afterEach: (ctx: TestContext) => Promise<void>;
  };
};

export async function setUpTestEnvironment(
  prefix: string,
  { cache }: EnvironmentOptions = {}
): Promise<TestEnvironmentResult> {
  const { traceFn, tracer } = await setupTracing();

  const workspaceUrl = getHostUrl(host, 'workspaces').replace('{workspaceId}', workspace);

  // All setup actions belong to the setup span
  const suiteSpan = tracer.startSpan(
    `[Test Suite] ${prefix}`,
    { attributes: { [TraceAttributes.KIND]: 'test-suite' } },
    context.active()
  );

  const suiteSpanCtx = traceAPI.setSpan(context.active(), suiteSpan);

  const database = await tracer.startActiveSpan(
    `[Test setup] ${prefix}`,
    { attributes: { [TraceAttributes.KIND]: 'test-suite-setup' } },
    suiteSpanCtx,
    async (span) => {
      const result = await buildDatabase(prefix, traceFn);
      span.end();

      return result;
    }
  );

  if (database === '') throw new Error('Database not created');

  const hooks = {
    beforeAll: async () => {
      return;
    },
    afterAll: async () => {
      await tracer.startActiveSpan(
        `[Test teardown] ${prefix}`,
        { attributes: { [TraceAttributes.KIND]: 'test-suite-teardown' } },
        suiteSpanCtx,
        async (span) => {
          await api.databases.deleteDatabase(workspace, database);
          span.end();
        }
      );

      suiteSpan.end();
    },
    beforeEach: async (ctx: TestContext) => {
      const suiteSpanCtx = traceAPI.setSpan(context.active(), suiteSpan);
      ctx.span = tracer.startSpan(
        `[Test case] ${ctx.meta.name}`,
        { attributes: { [TraceAttributes.KIND]: 'test-case' } },
        suiteSpanCtx
      );
      ctx.suiteSpanCtx = suiteSpanCtx;
    },
    afterEach: async (ctx: TestContext) => {
      ctx.span?.end();
    }
  };

  const clientOptions = {
    databaseURL: `${workspaceUrl}/db/${database}`,
    branch: 'main',
    apiKey,
    fetch,
    cache,
    trace: traceFn
  };

  const api = new XataApiClient({ apiKey, fetch, host, trace: traceFn });
  const client = new XataClient(clientOptions);
  const baseClient = new BaseClient(clientOptions);

  return { api, client, baseClient, clientOptions, database: database, workspace, hooks };
}

async function buildDatabase(prefix: string, trace: TraceFunction) {
  const api = new XataApiClient({ apiKey, fetch, host, trace });
  // Timestamp to avoid collisions
  const id = Date.now().toString(36);
  const { databaseName: database } = await api.databases.createDatabase(
    workspace,
    `sdk-integration-test-${prefix}-${id}`
  );

  await api.tables.createTable(workspace, database, 'main', 'teams');
  await api.tables.createTable(workspace, database, 'main', 'users');

  const teamColumns = schema.tables.find(({ name }) => name === 'teams')?.columns;
  const userColumns = schema.tables.find(({ name }) => name === 'users')?.columns;
  if (!teamColumns || !userColumns) throw new Error('Unable to find tables');

  await api.tables.setTableSchema(workspace, database, 'main', 'teams', { columns: teamColumns });
  await api.tables.setTableSchema(workspace, database, 'main', 'users', { columns: userColumns });

  return database;
}

function getProvider(provider = 'production'): HostProvider {
  if (isHostProviderAlias(provider)) {
    return provider;
  }

  const [main, workspaces] = provider.split(',');
  if (!main || !workspaces) {
    throw new Error(
      `Invalid XATA_API_PROVIDER environment variable, expected either "production", "staging" or "apiUrl,workspacesUrl"`
    );
  }
  return { main, workspaces };
}

declare module 'vitest' {
  export interface TestContext {
    span?: Span;
    suiteSpanCtx?: Context;
  }
}
