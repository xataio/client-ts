import { VERSION } from '../version';
import { FetcherError, PossibleErrors } from './errors';

const resolveUrl = (url: string, queryParams: Record<string, any> = {}, pathParams: Record<string, string> = {}) => {
  // Remove nulls and undefineds from query params
  const cleanQueryParams = Object.entries(queryParams).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    return { ...acc, [key]: value };
  }, {} as Record<string, any>);

  const query = new URLSearchParams(cleanQueryParams).toString();
  const queryString = query.length > 0 ? `?${query}` : '';
  return url.replace(/\{\w*\}/g, (key) => pathParams[key.slice(1, -1)]) + queryString;
};

// Typed only the subset of the spec we actually use (to be able to build a simple mock)
export type FetchImpl = (
  url: string,
  init?: { body?: string; headers?: Record<string, string>; method?: string }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
  headers?: {
    get(name: string): string | null;
  };
}>;

export type WorkspaceApiUrlBuilder = (path: string, pathParams: Record<string, string>) => string;

export type FetcherExtraProps = {
  apiUrl: string;
  workspacesApiUrl: string | WorkspaceApiUrlBuilder;
  fetchImpl: FetchImpl;
  apiKey: string;
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
  path,
  workspacesApiUrl,
  apiUrl,
  pathParams
}: {
  path: string;
  workspacesApiUrl: string | WorkspaceApiUrlBuilder;
  apiUrl: string;
  pathParams?: Record<string, string>;
}): string {
  if (!pathParams?.workspace) return `${apiUrl}${path}`;

  const url = typeof workspacesApiUrl === 'string' ? `${workspacesApiUrl}${path}` : workspacesApiUrl(path, pathParams);
  return url.replace('{workspaceId}', pathParams.workspace);
}

// The host header is needed by Node.js on localhost.
// It is ignored by fetch() in the frontend
function hostHeader(url: string): { Host?: string } {
  const pattern = /.*:\/\/(?<host>[^/]+).*/;
  const { groups } = pattern.exec(url) ?? {};

  return groups?.host ? { Host: groups.host } : {};
}

export async function fetch<
  TData,
  TError extends ErrorWrapper<{ status: unknown; payload: PossibleErrors }>,
  TBody extends Record<string, unknown> | undefined | null,
  THeaders extends Record<string, unknown>,
  TQueryParams extends Record<string, unknown>,
  TPathParams extends Record<string, string>
>({
  url: path,
  method,
  body,
  headers,
  pathParams,
  queryParams,
  fetchImpl,
  apiKey,
  apiUrl,
  workspacesApiUrl
}: FetcherOptions<TBody, THeaders, TQueryParams, TPathParams> & FetcherExtraProps): Promise<TData> {
  const baseUrl = buildBaseUrl({ path, workspacesApiUrl, pathParams, apiUrl });
  const fullUrl = resolveUrl(baseUrl, queryParams, pathParams);

  // Node.js on localhost won't resolve localhost subdomains unless mapped in /etc/hosts
  // So, instead, we use localhost without subdomains, but will add a Host header
  const url = fullUrl.includes('localhost') ? fullUrl.replace(/^[^.]+\./, 'http://') : fullUrl;

  const response = await fetchImpl(url, {
    method: method.toUpperCase(),
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `Xata client-ts/${VERSION}`,
      ...headers,
      ...hostHeader(fullUrl),
      Authorization: `Bearer ${apiKey}`
    }
  });

  // No content
  if (response.status === 204) {
    return {} as unknown as TData;
  }

  const requestId = response.headers?.get('x-request-id') ?? undefined;
  const payload = await parsePayload(response);
  if (response.ok) return payload;

  const error = payload ?? 'Unknown error';
  throw new FetcherError(response.status, error as TError['payload'], requestId);
}

async function parsePayload(response: { json: () => any; text: () => any }) {
  try {
    return response.json();
  } catch (error) {
    return response.text();
  }
}
