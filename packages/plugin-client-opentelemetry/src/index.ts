import { SpanStatusCode, propagation, Tracer, context as contextAPI } from '@opentelemetry/api';

export const buildTraceFunction =
  (tracer: Tracer) =>
  async <T>(
    name: string,
    fn: (options: {
      setAttributes: (attrs: Record<string, any>) => void;
      propagateTrace: (headers: Record<string, any>) => void;
    }) => T,
    attributes: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> => {
    return await tracer.startActiveSpan(name, { attributes }, contextAPI.active(), async (span) => {
      try {
        const setAttributes = (attrs: Record<string, any>) => {
          for (const [key, value] of Object.entries(attrs)) {
            span.setAttribute(key, value);
          }
        };

        const propagateTrace = (headers: Record<string, string>) => {
          propagation.inject(contextAPI.active(), headers);
        };

        return await fn({ setAttributes, propagateTrace });
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
    });
  };

function isHttpError(error: any): error is Error & { status?: number } {
  return typeof error === 'object' && typeof error.status === 'number';
}
