import { trace as traceAPI, context as contextAPI, propagation, Tracer } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { detectResources, envDetector } from '@opentelemetry/resources';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { test as baseTest, describe as baseDescribe, TestFunction, SuiteFactory } from 'vitest';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

const TRACER_NAME = 'Xata SDK';
let tracingConfigured = false;
let globalTracer: Tracer | undefined;

export async function describe(name: string, factory?: SuiteFactory) {
  await setupTracing();

  return baseDescribe(name, factory);
}

export async function test(title: string, fn?: TestFunction, timeout?: number) {
  return baseTest(
    title,
    async (ctx) => {
      if (!fn) return;
      if (ctx.suiteSpanCtx && ctx.span) {
        return await contextAPI.bind(traceAPI.setSpan(ctx.suiteSpanCtx, ctx.span), fn)(ctx);
      }
      return await fn(ctx);
    },
    timeout
  );
}

export async function setupTracing() {
  if (tracingConfigured) {
    return;
  }

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

  globalTracer = tracerProvider?.getTracer(TRACER_NAME);
  if (!globalTracer) throw new Error('Unable to build tracer');

  tracingConfigured = true;
}

export function getTracer(): Tracer | undefined {
  return globalTracer;
}
