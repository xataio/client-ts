import { Span } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { detectResources, envDetector } from '@opentelemetry/resources';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import realFetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { File, Suite, TestContext, vi } from 'vitest';
import { BaseClient, CacheImpl, XataApiClient } from '../../packages/client/src';
import { getHostUrl, parseProviderString } from '../../packages/client/src/api/providers';
import { TraceAttributes } from '../../packages/client/src/schema/tracing';
import { XataClient } from '../../packages/codegen/example/xata';
import { buildTraceFunction } from '../../packages/plugin-client-opentelemetry';
import { schema } from '../mock_data';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const apiKey = process.env.XATA_API_KEY ?? '';
if (apiKey === '') throw new Error('XATA_API_KEY environment variable is not set');

const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const host = parseProviderString(process.env.XATA_API_PROVIDER);
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
  if (host === null) {
    throw new Error(
      `Invalid XATA_API_PROVIDER environment variable, expected either "production", "staging" or "apiUrl,workspacesUrl"`
    );
  }

  const { trace, tracer } = await setupTracing();

  // Timestamp to avoid collisions
  const id = Date.now().toString(36);

  const api = new XataApiClient({ apiKey, fetch, host });
  const { databaseName: database } = await api.database.createDatabase(
    workspace,
    `sdk-integration-test-${prefix}-${id}`
  );

  const workspaceUrl = getHostUrl(host, 'workspaces').replace('{workspaceId}', workspace);

  const clientOptions = {
    databaseURL: `${workspaceUrl}/db/${database}`,
    branch: 'main',
    apiKey,
    fetch,
    cache,
    trace
  };

  await api.tables.createTable(workspace, database, 'main', 'teams');
  await api.tables.createTable(workspace, database, 'main', 'pets');
  await api.tables.createTable(workspace, database, 'main', 'users');

  const teamColumns = schema.tables.find(({ name }) => name === 'teams')?.columns;
  const petColumns = schema.tables.find(({ name }) => name === 'pets')?.columns;
  const userColumns = schema.tables.find(({ name }) => name === 'users')?.columns;
  if (!teamColumns || !userColumns || !petColumns) throw new Error('Unable to find tables');

  await api.tables.setTableSchema(workspace, database, 'main', 'teams', { columns: teamColumns });
  await api.tables.setTableSchema(workspace, database, 'main', 'pets', { columns: petColumns });
  await api.tables.setTableSchema(workspace, database, 'main', 'users', { columns: userColumns });

  let span: Span | undefined;

  const hooks = {
    beforeAll: async () => {
      span = tracer?.startSpan(prefix, { attributes: { [TraceAttributes.KIND]: 'test-suite' } });
    },
    afterAll: async () => {
      try {
        await api.database.deleteDatabase(workspace, database);
      } catch (e) {
        // Ignore error, delete database during ES snapshot fails
        console.error('Delete database failed', e);
      }
      span?.end();
    },
    beforeEach: async (ctx: TestContext) => {
      ctx.span = tracer?.startSpan(ctx.meta.name, { attributes: { [TraceAttributes.KIND]: 'test-case' } });
    },
    afterEach: async (ctx: TestContext) => {
      ctx.span?.end();
    }
  };

  const client = new XataClient(clientOptions);
  const baseClient = new BaseClient(clientOptions);

  return { api, client, baseClient, clientOptions, database, workspace, hooks };
}

async function setupTracing() {
  const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!url) return {};

  const resource = await detectResources({ detectors: [envDetector] });
  resource.attributes[SemanticResourceAttributes.SERVICE_NAME] = 'sdk_tests';

  const tracerProvider = new NodeTracerProvider({ resource });
  registerInstrumentations({ tracerProvider });

  const exporter = new OTLPTraceExporter({ url });
  tracerProvider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  tracerProvider.register();

  const tracer = tracerProvider?.getTracer('Xata SDK');
  if (!tracer) throw new Error('Unable to build tracer');

  const trace = buildTraceFunction(tracer);

  return { trace, tracer };
}

declare module 'vitest' {
  export interface TestContext {
    span?: Span;
  }
}
