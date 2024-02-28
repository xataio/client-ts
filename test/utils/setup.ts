import { Span } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { detectResources, envDetector } from '@opentelemetry/resources';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import dotenv from 'dotenv';
import { join } from 'path';
import { File, Mock, Suite, TestContext, vi } from 'vitest';
import { BaseClient, XataApiClient } from '../../packages/client/src';
import { getHostUrl, parseProviderString } from '../../packages/client/src/api/providers';
import { TraceAttributes } from '../../packages/client/src/schema/tracing';
import { XataClient } from '../../packages/codegen/example/xata';
import { buildTraceFunction } from '../../packages/plugin-client-opentelemetry';
import { pgRollMigrations } from '../mock_data';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const apiKey = process.env.XATA_API_KEY ?? '';
if (apiKey === '') throw new Error('XATA_API_KEY environment variable is not set');

const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const host = parseProviderString(process.env.XATA_API_PROVIDER);

const region = process.env.XATA_REGION || 'us-east-1';

export type EnvironmentOptions = {
  fetch?: any;
};

export type TestEnvironmentResult = {
  api: XataApiClient;
  client: XataClient;
  baseClient: BaseClient;
  database: string;
  workspace: string;
  region: string;
  clientOptions: {
    databaseURL: string;
    fetch: Mock;
    apiKey: string;
    branch: string;
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
  { fetch: envFetch }: EnvironmentOptions = {}
): Promise<TestEnvironmentResult> {
  if (host === null) {
    throw new Error(
      `Invalid XATA_API_PROVIDER environment variable, expected either "production", "staging" or "apiUrl,workspacesUrl"`
    );
  }

  const fetch = vi.fn(envFetch ?? globalThis.fetch);

  const { trace, tracer } = await setupTracing();

  // Timestamp to avoid collisions
  const id = Date.now().toString(36);

  const api = new XataApiClient({ apiKey, fetch, host, clientName: 'sdk-tests' });
  const { databaseName: database } = await api.databases.createDatabase({
    pathParams: { workspaceId: workspace, dbName: `sdk-integration-test-${prefix}-${id}` },
    body: { region },
    headers: { 'X-Features': 'feat-pgroll-migrations=1' }
  });

  const workspaceUrl = getHostUrl(host, 'workspaces').replace('{workspaceId}', workspace).replace('{region}', region);

  const clientOptions = {
    databaseURL: `${workspaceUrl}/db/${database}`,
    branch: 'main',
    apiKey,
    fetch,
    trace,
    clientName: 'sdk-tests'
  };

  for (const operation of pgRollMigrations) {
    const { jobID } = await api.migrations.applyMigration({
      pathParams: { workspace, region, dbBranchName: `${database}:main` },
      body: { operations: [operation] }
    });

    await waitForMigrationToFinish(api, workspace, region, database, 'main', jobID);

    if ('create_table' in operation) {
      const { jobID } = await api.migrations.adaptTable({
        pathParams: { workspace, region, dbBranchName: `${database}:main`, tableName: operation.create_table.name }
      });

      await waitForMigrationToFinish(api, workspace, region, database, 'main', jobID);
    }
  }

  let span: Span | undefined;

  const hooks = {
    beforeAll: async () => {
      span = tracer?.startSpan(prefix, { attributes: { [TraceAttributes.KIND]: 'test-suite' } });
    },
    afterAll: async () => {
      try {
        await api.databases.deleteDatabase({ pathParams: { workspaceId: workspace, dbName: database } });
      } catch (e) {
        // Ignore error, delete database during ES snapshot fails
        console.error('Delete database failed', e);
      }
      span?.end();
    },
    beforeEach: async (ctx: TestContext) => {
      ctx.span = tracer?.startSpan(ctx.task.name, { attributes: { [TraceAttributes.KIND]: 'test-case' } });
    },
    afterEach: async (ctx: TestContext) => {
      ctx.span?.end();
    }
  };

  const client = new XataClient(clientOptions);
  const baseClient = new BaseClient(clientOptions);

  return { api, client, baseClient, clientOptions, database, workspace, region, hooks };
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

async function waitForMigrationToFinish(
  api: XataApiClient,
  workspace: string,
  region: string,
  database: string,
  branch: string,
  jobId: string
) {
  const { status, error } = await api.migrations.getMigrationJobStatus({
    pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, jobId }
  });
  if (status === 'failed') {
    throw new Error(`Migration failed, ${error}`);
  }

  if (status === 'completed') {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await waitForMigrationToFinish(api, workspace, region, database, branch, jobId);
}
