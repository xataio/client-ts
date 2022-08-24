import { SpanStatusCode, Tracer } from '@opentelemetry/api';

export const buildTraceFunction =
  (tracer: Tracer) =>
  async <T>(
    name: string,
    fn: (options: { setAttributes: (attrs: Record<string, any>) => void; onError: (message: string) => void }) => T,
    attributes: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> => {
    return await tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const setAttributes = (attrs: Record<string, any>) => {
          for (const [key, value] of Object.entries(attrs)) {
            span.setAttribute(key, value);
          }
        };

        const onError = (message: string) => {
          span.setStatus({ code: SpanStatusCode.ERROR, message });
        };

        return await fn({ setAttributes, onError });
      } catch (error: any) {
        span.recordException(error.message ?? error.toString());
        throw error;
      } finally {
        span.end();
      }
    });
  };
