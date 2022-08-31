import { Span, Context, trace as traceAPI, context as contextAPI, propagation } from '@opentelemetry/api';
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
import {
  BaseClient,
  CacheImpl,
  XataApiClient,
  BaseClientOptions,
  XataApiClientOptions,
  contains
} from '../../packages/client/src';
import { getHostUrl, HostProvider, isHostProviderAlias } from '../../packages/client/src/api/providers';
import { TraceAttributes, TraceFunction } from '../../packages/client/src/schema/tracing';
import { XataClient } from '../../packages/codegen/example/xata';
import { buildTraceFunction } from '../../packages/plugin-client-opentelemetry';
import { teamColumns, userColumns } from '../mock_data';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

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
  const tracing = await setupTracing();

  const workspaceUrl = getHostUrl(host, 'workspaces').replace('{workspaceId}', workspace);
  const suiteSpan = tracing.tracer?.startSpan('suite: ' + prefix, {
    attributes: { [TraceAttributes.KIND]: 'test-suite' }
  });

  // All setup actions belong to the setup span
  let setupSpan: Span | undefined;
  let setupEnvTrace: typeof tracing.trace;
  if (tracing.tracer && suiteSpan) {
    const suiteCtx = traceAPI.setSpan(contextAPI.active(), suiteSpan);
    setupSpan = tracing.tracer.startSpan(
      'setup environment',
      { attributes: { [TraceAttributes.KIND]: 'test-suite-setup' } },
      suiteCtx
    );
    setupEnvTrace = contextAPI.bind(traceAPI.setSpan(suiteCtx, setupSpan), tracing.trace);
  }

  // Setup the environment
  let database: string;
  try {
    const api = new XataApiClient({ apiKey, fetch, host, trace: setupEnvTrace });
    // Timestamp to avoid collisions
    const id = Date.now().toString(36);
    const { databaseName: dbName } = await api.databases.createDatabase(
      workspace,
      `sdk-integration-test-${prefix}-${id}`
    );
    database = dbName;

    await api.tables.createTable(workspace, database, 'main', 'teams');
    await api.tables.createTable(workspace, database, 'main', 'users');
    await api.tables.setTableSchema(workspace, database, 'main', 'teams', { columns: teamColumns });
    await api.tables.setTableSchema(workspace, database, 'main', 'users', { columns: userColumns });
  } finally {
    setupSpan?.end();
  }

  const hooks = {
    beforeAll: async () => {
      return;
    },
    afterAll: async () => {
      await api.databases.deleteDatabase(workspace, database);
      suiteSpan?.end();
    },
    beforeEach: async (ctx: TestContext) => {
      if (suiteSpan) {
        const suiteCtx = traceAPI.setSpan(contextAPI.active(), suiteSpan);
        ctx.span = tracing.tracer?.startSpan(
          'test: ' + ctx.meta.name,
          { attributes: { [TraceAttributes.KIND]: 'test-case' } },
          suiteCtx
        );
      }
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
    trace: tracing.trace
  };

  const api = new XataApiClient({ apiKey, fetch, host, trace: tracing.trace });
  const client = new XataClient(clientOptions);
  const baseClient = new BaseClient(clientOptions);

  return { api, client, baseClient, clientOptions, database, workspace, hooks };
}

async function setupTracing() {
  const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!url) return {};

  /* Set Global Propagator */
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

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
  }
}
