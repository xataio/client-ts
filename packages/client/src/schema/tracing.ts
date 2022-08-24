export type AttributeDictionary = Record<string, string | number | boolean | undefined>;

export type TraceFunction = <T>(
  name: string,
  fn: (options: {
    setAttributes: (attrs: AttributeDictionary) => void;
    onError: (message: string, options?: { ignoreErrorKind?: boolean }) => void;
  }) => T,
  options?: AttributeDictionary
) => Promise<T>;

export const defaultTrace: TraceFunction = async <T>(
  _name: string,
  fn: (options: {
    setAttributes: (attrs: Record<string, string | number | boolean | undefined>) => void;
    onError: (message: string) => void;
  }) => T,
  _options?: Record<string, any>
): Promise<T> => {
  return await fn({
    setAttributes: () => {
      return;
    },
    onError: () => {
      return;
    }
  });
};

export const TraceAttributes = {
  KIND: 'xata.trace.kind',

  VERSION: 'xata.sdk.version',

  TABLE: 'xata.table',

  HTTP_REQUEST_ID: 'http.request_id',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_HOST: 'http.host',
  HTTP_SCHEME: 'http.scheme',
  HTTP_USER_AGENT: 'http.user_agent',
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_ROUTE: 'http.route',
  HTTP_TARGET: 'http.target'
};
