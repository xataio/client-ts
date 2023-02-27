import { TraceFunction } from '../schema/tracing';
import { FetchImpl } from '../util/fetch';
import { PossibleErrors } from './errors';
import { fetch, WorkspaceApiUrlBuilder } from './fetcher';

export type ControlPlaneFetcherExtraProps = {
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
};

export type ErrorWrapper<TError> = TError | { status: 'unknown'; payload: string };

export type ControlPlaneFetcherOptions<TBody, THeaders, TQueryParams, TPathParams> = {
  url: string;
  method: string;
  body?: TBody;
  headers?: THeaders;
  queryParams?: TQueryParams;
  pathParams?: TPathParams;
  signal?: AbortSignal;
} & ControlPlaneFetcherExtraProps;

export const controlPlaneFetch = async <
  TData,
  TError extends ErrorWrapper<{ status: unknown; payload: PossibleErrors }>,
  TBody extends Record<string, unknown> | undefined | null,
  THeaders extends Record<string, unknown>,
  TQueryParams extends Record<string, unknown>,
  TPathParams extends Partial<Record<string, string | number>>
>(
  options: ControlPlaneFetcherOptions<TBody, THeaders, TQueryParams, TPathParams>
): Promise<TData> =>
  fetch<TData, TError, TBody, THeaders, TQueryParams, TPathParams>({ ...options, endpoint: 'controlPlane' });
