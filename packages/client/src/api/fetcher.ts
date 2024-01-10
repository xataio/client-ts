import { TraceAttributes, TraceFunction } from '../schema/tracing';
import { ApiRequestPool, FetchImpl } from '../util/fetch';
import { compact, compactObject, isBlob, isDefined, isObject, isString } from '../util/lang';
import { fetchEventSource } from '../util/sse';
import { generateUUID } from '../util/uuid';
import { VERSION } from '../version';
import { FetcherError, PossibleErrors } from './errors';
import { parseWorkspacesUrlParts } from './providers';

const pool = new ApiRequestPool();

const resolveUrl = (
  url: string,
  queryParams: Record<string, any> = {},
  pathParams: Partial<Record<string, string | number>> = {}
) => {
  // Remove nulls and undefineds from query params
  const cleanQueryParams = Object.entries(queryParams).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    return { ...acc, [key]: value };
  }, {} as Record<string, any>);

  const query = new URLSearchParams(cleanQueryParams).toString();
  const queryString = query.length > 0 ? `?${query}` : '';

  // We need to encode the path params because they can contain special characters
  // Special case, `:` does not need to be encoded as we use it as a separator
  const cleanPathParams = Object.entries(pathParams).reduce((acc, [key, value]) => {
    return { ...acc, [key]: encodeURIComponent(String(value ?? '')).replace('%3A', ':') };
  }, {} as Record<string, string>);

  return url.replace(/\{\w*\}/g, (key) => cleanPathParams[key.slice(1, -1)]) + queryString;
};

export type WorkspaceApiUrlBuilder = (path: string, pathParams: Partial<Record<string, string | number>>) => string;

export type FetcherExtraProps = {
  endpoint: 'controlPlane' | 'dataPlane';
  apiUrl: string;
  workspacesApiUrl: string | WorkspaceApiUrlBuilder;
  fetch: FetchImpl;
  apiKey: string;
  trace: TraceFunction;
  signal?: AbortSignal;
  clientID?: string;
  sessionID?: string;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
  fetchOptions?: Record<string, unknown>;
  rawResponse?: boolean;
  headers?: Record<string, unknown>;
};

export type ErrorWrapper<TError> = TError | { status: 'unknown'; payload: string };

export type FetcherOptions<TBody, THeaders, TQueryParams, TPathParams> = {
  url: string;
  method: string;
  body?: TBody;
  headers?: THeaders;
  queryParams?: TQueryParams;
  pathParams?: TPathParams;
} & FetcherExtraProps;

function buildBaseUrl({
  method,
  endpoint,
  path,
  workspacesApiUrl,
  apiUrl,
  pathParams = {}
}: {
  method: string;
  endpoint: 'controlPlane' | 'dataPlane';
  path: string;
  workspacesApiUrl: string | WorkspaceApiUrlBuilder;
  apiUrl: string;
  pathParams?: Partial<Record<string, string | number>>;
}): string {
  if (endpoint === 'dataPlane') {
    let url = isString(workspacesApiUrl) ? `${workspacesApiUrl}${path}` : workspacesApiUrl(path, pathParams);

    // Special case, for file uploads, we have a different subdomain
    // TODO: We should re-use OpenAPI spec to determine this via servers variables
    if (
      method.toUpperCase() === 'PUT' &&
      [
        '/db/{dbBranchName}/tables/{tableName}/data/{recordId}/column/{columnName}/file',
        '/db/{dbBranchName}/tables/{tableName}/data/{recordId}/column/{columnName}/file/{fileId}'
      ].includes(path)
    ) {
      const { host } = parseWorkspacesUrlParts(url) ?? {};
      switch (host) {
        case 'production':
          url = url.replace('xata.sh', 'upload.xata.sh');
          break;
        case 'staging':
          url = url.replace('staging-xata.dev', 'upload.staging-xata.dev');
          break;
        case 'dev':
          url = url.replace('dev-xata.dev', 'upload.dev-xata.dev');
          break;
      }
    }

    const urlWithWorkspace = isString(pathParams.workspace)
      ? url.replace('{workspaceId}', String(pathParams.workspace))
      : url;

    return isString(pathParams.region)
      ? urlWithWorkspace.replace('{region}', String(pathParams.region))
      : urlWithWorkspace;
  }

  return `${apiUrl}${path}`;
}

// The host header is needed by Node.js on localhost.
// It is ignored by fetch() in the frontend
function hostHeader(url: string): { Host?: string } {
  const pattern = /.*:\/\/(?<host>[^/]+).*/;
  const { groups } = pattern.exec(url) ?? {};

  return groups?.host ? { Host: groups.host } : {};
}

async function parseBody<T>(body?: T, headers?: Record<string, unknown>): Promise<any> {
  if (!isDefined(body)) return undefined;

  // If body is a blob or has a text() method, we don't need to do anything
  if (isBlob(body) || typeof (body as any).text === 'function') {
    return body;
  }

  const { 'Content-Type': contentType } = headers ?? {};
  if (String(contentType).toLowerCase() === 'application/json' && isObject(body)) {
    return JSON.stringify(body);
  }

  return body;
}

const defaultClientID = generateUUID();

export async function fetch<
  TData,
  TError extends ErrorWrapper<{ status: unknown; payload: PossibleErrors }>,
  TBody extends Record<string, unknown> | Record<string, unknown>[] | Blob | undefined | null,
  THeaders extends Record<string, unknown>,
  TQueryParams extends Record<string, unknown>,
  TPathParams extends Partial<Record<string, string | number>>
>({
  url: path,
  method,
  body,
  headers: customHeaders,
  pathParams,
  queryParams,
  fetch,
  apiKey,
  endpoint,
  apiUrl,
  workspacesApiUrl,
  trace,
  signal,
  clientID,
  sessionID,
  clientName,
  xataAgentExtra,
  fetchOptions = {},
  rawResponse = false
}: FetcherOptions<TBody, THeaders, TQueryParams, TPathParams> & FetcherExtraProps): Promise<TData> {
  pool.setFetch(fetch);

  return await trace(
    `${method.toUpperCase()} ${path}`,
    async ({ setAttributes }) => {
      const baseUrl = buildBaseUrl({ method, endpoint, path, workspacesApiUrl, pathParams, apiUrl });
      const fullUrl = resolveUrl(baseUrl, queryParams, pathParams);

      // Node.js on localhost won't resolve localhost subdomains unless mapped in /etc/hosts
      // So, instead, we use localhost without subdomains, but will add a Host header
      // We remove two subdomains because we need be able to resolve localhost URLs like
      // http://ws-id.dev.localhost
      const url = fullUrl.includes('localhost') ? fullUrl.replace(/^[^.]+\.[^.]+\./, 'http://') : fullUrl;
      setAttributes({
        [TraceAttributes.HTTP_URL]: url,
        [TraceAttributes.HTTP_TARGET]: resolveUrl(path, queryParams, pathParams)
      });

      const xataAgent = compact([
        ['client', 'TS_SDK'],
        ['version', VERSION],
        isDefined(clientName) ? ['service', clientName] : undefined,
        ...Object.entries(xataAgentExtra ?? {})
      ])
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      const headers = compactObject({
        'Accept-Encoding': 'identity',
        'Content-Type': 'application/json',
        'X-Xata-Client-ID': clientID ?? defaultClientID,
        'X-Xata-Session-ID': sessionID ?? generateUUID(),
        'X-Xata-Agent': xataAgent,
        ...customHeaders,
        ...hostHeader(fullUrl),
        Authorization: `Bearer ${apiKey}`
      });

      const response = await pool.request(url, {
        ...fetchOptions,
        method: method.toUpperCase(),
        body: await parseBody(body, headers),
        headers,
        signal
      });

      const { host, protocol } = parseUrl(response.url);
      const requestId = response.headers?.get('x-request-id') ?? undefined;
      setAttributes({
        [TraceAttributes.KIND]: 'http',
        [TraceAttributes.HTTP_REQUEST_ID]: requestId,
        [TraceAttributes.HTTP_STATUS_CODE]: response.status,
        [TraceAttributes.HTTP_HOST]: host,
        [TraceAttributes.HTTP_SCHEME]: protocol?.replace(':', ''),
        [TraceAttributes.CLOUDFLARE_RAY_ID]: response.headers?.get('cf-ray') ?? undefined
      });

      const message = response.headers?.get('x-xata-message');
      if (message) console.warn(message);

      // No content
      if (response.status === 204) {
        return {} as unknown as TData;
      }

      // Rate limit exceeded
      if (response.status === 429) {
        throw new FetcherError(response.status, 'Rate limit exceeded', requestId);
      }

      try {
        const jsonResponse = rawResponse ? await response.blob() : await response.json();

        if (response.ok) {
          return jsonResponse;
        }

        throw new FetcherError(response.status, jsonResponse as TError['payload'], requestId);
      } catch (error) {
        throw new FetcherError(response.status, error, requestId);
      }
    },
    { [TraceAttributes.HTTP_METHOD]: method.toUpperCase(), [TraceAttributes.HTTP_ROUTE]: path }
  );
}

export function fetchSSERequest<
  TData,
  TError extends ErrorWrapper<{ status: unknown; payload: PossibleErrors }>,
  TBody extends Record<string, unknown> | undefined | null,
  THeaders extends Record<string, unknown>,
  TQueryParams extends Record<string, unknown>,
  TPathParams extends Partial<Record<string, string | number>>
>({
  url: path,
  method,
  body,
  headers: customHeaders,
  pathParams,
  queryParams,
  fetch,
  apiKey,
  endpoint,
  apiUrl,
  workspacesApiUrl,
  onMessage,
  onError,
  onClose,
  signal,
  clientID,
  sessionID,
  clientName,
  xataAgentExtra
}: FetcherOptions<TBody, THeaders, TQueryParams, TPathParams> &
  FetcherExtraProps & {
    onMessage?: (message: TData) => void;
    onError?: (error: TError) => void;
    onClose?: () => void;
  }): void {
  const baseUrl = buildBaseUrl({ method, endpoint, path, workspacesApiUrl, pathParams, apiUrl });
  const fullUrl = resolveUrl(baseUrl, queryParams, pathParams);

  // Node.js on localhost won't resolve localhost subdomains unless mapped in /etc/hosts
  // So, instead, we use localhost without subdomains, but will add a Host header
  const url = fullUrl.includes('localhost') ? fullUrl.replace(/^[^.]+\./, 'http://') : fullUrl;

  void fetchEventSource(url, {
    method,
    body: JSON.stringify(body),
    fetch,
    signal,
    headers: {
      'X-Xata-Client-ID': clientID ?? defaultClientID,
      'X-Xata-Session-ID': sessionID ?? generateUUID(),
      'X-Xata-Agent': compact([
        ['client', 'TS_SDK'],
        ['version', VERSION],
        isDefined(clientName) ? ['service', clientName] : undefined,
        ...Object.entries(xataAgentExtra ?? {})
      ])
        .map(([key, value]) => `${key}=${value}`)
        .join('; '),
      ...customHeaders,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    onmessage(ev) {
      onMessage?.(JSON.parse(ev.data));
    },
    onerror(ev) {
      onError?.(JSON.parse(ev.data));
    },
    onclose() {
      onClose?.();
    }
  });
}

function parseUrl(url: string): { host?: string; protocol?: string } {
  try {
    const { host, protocol } = new URL(url);

    return { host, protocol };
  } catch (error) {
    return {};
  }
}
