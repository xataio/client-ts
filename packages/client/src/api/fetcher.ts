import { TraceAttributes, TraceFunction } from '../schema/tracing';
import { ApiRequestPool, FetchImpl } from '../util/fetch';
import { compact, isDefined, isString } from '../util/lang';
import { generateUUID } from '../util/uuid';
import { VERSION } from '../version';
import { FetcherError, PossibleErrors } from './errors';

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
  fetchImpl: FetchImpl;
  apiKey: string;
  trace: TraceFunction;
  signal?: AbortSignal;
  clientID?: string;
  sessionID?: string;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
  fetchOptions?: Record<string, unknown>;
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
  endpoint,
  path,
  workspacesApiUrl,
  apiUrl,
  pathParams = {}
}: {
  endpoint: 'controlPlane' | 'dataPlane';
  path: string;
  workspacesApiUrl: string | WorkspaceApiUrlBuilder;
  apiUrl: string;
  pathParams?: Partial<Record<string, string | number>>;
}): string {
  if (endpoint === 'dataPlane') {
    const url = isString(workspacesApiUrl) ? `${workspacesApiUrl}${path}` : workspacesApiUrl(path, pathParams);

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

const defaultClientID = generateUUID();

export async function fetch<
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
  fetchImpl,
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
  fetchOptions = {}
}: FetcherOptions<TBody, THeaders, TQueryParams, TPathParams> & FetcherExtraProps): Promise<TData> {
  pool.setFetch(fetchImpl);

  return await trace(
    `${method.toUpperCase()} ${path}`,
    async ({ setAttributes }) => {
      const baseUrl = buildBaseUrl({ endpoint, path, workspacesApiUrl, pathParams, apiUrl });
      const fullUrl = resolveUrl(baseUrl, queryParams, pathParams);

      // Node.js on localhost won't resolve localhost subdomains unless mapped in /etc/hosts
      // So, instead, we use localhost without subdomains, but will add a Host header
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

      const headers = {
        'Accept-Encoding': 'identity',
        'Content-Type': 'application/json',
        'X-Xata-Client-ID': clientID ?? defaultClientID,
        'X-Xata-Session-ID': sessionID ?? generateUUID(),
        'X-Xata-Agent': xataAgent,
        ...customHeaders,
        ...hostHeader(fullUrl),
        Authorization: `Bearer ${apiKey}`
      };

      const response = await pool.request(url, {
        ...fetchOptions,
        method: method.toUpperCase(),
        body: body ? JSON.stringify(body) : undefined,
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
        [TraceAttributes.HTTP_SCHEME]: protocol?.replace(':', '')
      });

      // No content
      if (response.status === 204) {
        return {} as unknown as TData;
      }

      // Rate limit exceeded
      if (response.status === 429) {
        throw new FetcherError(response.status, 'Rate limit exceeded', requestId);
      }

      try {
        const jsonResponse = await response.json();

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

function parseUrl(url: string): { host?: string; protocol?: string } {
  try {
    const { host, protocol } = new URL(url);

    return { host, protocol };
  } catch (error) {
    return {};
  }
}
