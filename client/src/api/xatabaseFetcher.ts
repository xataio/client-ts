/* eslint-disable @typescript-eslint/no-throw-literal */
/* eslint-disable @typescript-eslint/ban-types */
import type { SimpleError } from './xatabaseResponses';

const resolveUrl = (
  url: string,
  _queryParams: Record<string, unknown> = {},
  pathParams: Record<string, string> = {}
) => {
  return url.replace(/\{\w*\}/g, (key) => pathParams[key.slice(1, -1)]);
};

// Typed only the subset of the spec we actually use (to be able to build a simple mock)
type FetchImpl = (
  url: string,
  init?: { body?: string; headers?: Record<string, string>; method?: string }
) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export type XatabaseFetcherExtraProps = {
  fetchImpl: FetchImpl;
};

export type XatabaseFetcherOptions<TBody, THeaders, TQueryParams, TPathParams> = {
  url: string;
  method: string;
  body?: TBody;
  headers?: THeaders;
  queryParams?: TQueryParams;
  pathParams?: TPathParams;
} & { workspace?: string };

const fallbackError: SimpleError = { message: 'Network response was not ok', status: 500 };

function baseURLForWorkspace(workspace: string) {
  // Node.js on localhost won't resolve localhost subdomains unless mapped in /etc/hosts
  // So, instead, we use localhost without subdomains, but will add a Host header
  if (typeof window === 'undefined' && process.env.WORKSPACES_API_BASE_URL?.includes('localhost:')) {
    return process.env.WORKSPACES_API_BASE_URL.replace('{workspaceId}.', '');
  }
  return process.env.WORKSPACES_API_BASE_URL?.replace('{workspaceId}', workspace);
}

function hostHeaderForWorkspace(workspace: string) {
  const url = process.env.WORKSPACES_API_BASE_URL?.replace('{workspaceId}', workspace);
  if (!url) return;
  const [, hostname] = url.split('://');
  return hostname;
}

export async function xatabaseFetch<
  TData,
  TBody extends Record<string, unknown> | undefined,
  THeaders extends Record<string, unknown>,
  TQueryParams extends Record<string, unknown>,
  TPathParams extends Record<string, string>
>({
  url,
  method,
  body,
  headers,
  pathParams,
  queryParams,
  workspace,
  fetchImpl
}: XatabaseFetcherOptions<TBody, THeaders, TQueryParams, TPathParams> & XatabaseFetcherExtraProps): Promise<TData> {
  const baseURL = workspace ? baseURLForWorkspace(workspace) : process.env.MAIN_API_BASE_URL;
  const response = await fetchImpl(`${baseURL}${resolveUrl(url, queryParams, pathParams)}`, {
    method: method.toUpperCase(),
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      // The host header is needed by Node.js on localhost.
      // It is ignored by fetch() in the frontend
      ...(workspace ? { Host: hostHeaderForWorkspace(workspace) } : {})
    }
  });

  // No content
  if (response.status === 204) {
    return {} as TData;
  }

  try {
    const jsonResponse = await response.json();

    if (response.ok) {
      return jsonResponse;
    }

    throw jsonResponse;
  } catch (e) {
    if (e instanceof Error) {
      const error: SimpleError = {
        message: e.message,
        status: 500
      };
      throw error;
    } else if (typeof e === 'object' && typeof (e as SimpleError).message === 'string') {
      throw e;
    } else {
      throw fallbackError;
    }
  }
}
