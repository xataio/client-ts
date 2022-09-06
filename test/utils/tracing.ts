import { context, propagation, trace, Tracer } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { detectResources, envDetector } from '@opentelemetry/resources';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { test as baseTest, TestFunction } from 'vitest';
import { buildTraceFunction } from '../../packages/plugin-client-opentelemetry';

const TRACER_NAME = 'Xata SDK';
let globalTracer: Tracer | undefined;

export async function test(title: string, fn?: TestFunction, timeout?: number) {
  return baseTest(
    title,
    async (ctx) => {
      if (!fn) return;
      if (ctx.suiteSpanCtx && ctx.span) {
        return await context.bind(trace.setSpan(ctx.suiteSpanCtx, ctx.span), fn)(ctx);
      }
      return await fn(ctx);
    },
    timeout
  );
}

export async function setupTracing() {
  if (globalTracer !== undefined) {
    return {
      tracer: globalTracer,
      traceFn: buildTraceFunction(globalTracer)
    };
  }

  const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const resource = await detectResources({ detectors: [envDetector] });
  resource.attributes[SemanticResourceAttributes.SERVICE_NAME] = 'sdk_tests';

  const tracerProvider = new NodeTracerProvider({ resource });
  registerInstrumentations({ tracerProvider });

  if (url !== undefined) {
    const exporter = new OTLPTraceExporter({ url });
    tracerProvider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  }

  tracerProvider.register();

  globalTracer = tracerProvider.getTracer(TRACER_NAME);
  if (!globalTracer) throw new Error('Unable to build tracer');

  return { tracer: globalTracer, traceFn: buildTraceFunction(globalTracer) };
}
