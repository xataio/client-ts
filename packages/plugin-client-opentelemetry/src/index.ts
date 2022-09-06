import { SpanStatusCode, propagation, Tracer, context, trace } from '@opentelemetry/api';
import { TraceFunctionCallback, AttributeDictionary } from '@xata.io/client';

export const buildTraceFunction =
  (tracer: Tracer) =>
  async <T>(name: string, fn: TraceFunctionCallback<T>, attributes: AttributeDictionary = {}): Promise<T> => {
    const span = tracer.startSpan(name, { attributes });

    const setAttributes = (attrs: AttributeDictionary) => {
      for (const [key, value] of Object.entries(attrs)) {
        if (value) span.setAttribute(key, value);
      }
    };

    const setHeaders = (headers: AttributeDictionary) => {
      propagation.inject(context.active(), headers);
    };

    try {
      const spanCtx = trace.setSpan(context.active(), span);

      const result = await context.with(spanCtx, async () => {
        return await fn({ setAttributes, setHeaders });
      });

      return result;
    } catch (error: any) {
      const message = error.message ?? error.toString();

      // We only log errors 500, as they are the only ones that are not expected
      if (isHttpError(error) && !String(error.status).startsWith('5')) {
        span.setStatus({ code: SpanStatusCode.UNSET, message });
      } else {
        span.setStatus({ code: SpanStatusCode.ERROR, message });
      }

      span.recordException(message);

      throw error;
    } finally {
      span.end();
    }
  };

function isHttpError(error: any): error is Error & { status?: number } {
  return typeof error === 'object' && typeof error.status === 'number';
}
