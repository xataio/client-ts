import { defaultTrace, TraceFunction } from '../schema/tracing';
import { FetchImpl, getFetchImplementation } from '../util/fetch';
import { RequiredKeys } from '../util/types';
import { generateUUID } from '../util/uuid';
import { operationsByTag } from './components';
import type { FetcherExtraProps } from './fetcher';
import { getHostUrl, HostProvider } from './providers';

export type ApiExtraProps = Omit<FetcherExtraProps, 'endpoint'>;

export interface XataApiClientOptions {
  fetch?: FetchImpl;
  apiKey?: string;
  host?: HostProvider;
  trace?: TraceFunction;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
}

type UserProps = {
  headers?: Record<string, unknown>;
};

type XataApiProxy = {
  [Tag in keyof typeof operationsByTag]: {
    [Method in keyof (typeof operationsByTag)[Tag]]: (typeof operationsByTag)[Tag][Method] extends infer Operation extends (
      ...args: any
    ) => any
      ? Omit<Parameters<Operation>[0], keyof ApiExtraProps> extends infer Params
        ? RequiredKeys<Params> extends never
          ? (params?: Params & UserProps) => ReturnType<Operation>
          : (params: Params & UserProps) => ReturnType<Operation>
        : never
      : never;
  };
};

const buildApiClient = () =>
  class {
    constructor(options: XataApiClientOptions = {}) {
      const provider = options.host ?? 'production';
      const apiKey = options.apiKey;
      const trace = options.trace ?? defaultTrace;
      const clientID = generateUUID();

      if (!apiKey) {
        throw new Error('Could not resolve a valid apiKey');
      }

      const extraProps: ApiExtraProps = {
        apiUrl: getHostUrl(provider, 'main'),
        workspacesApiUrl: getHostUrl(provider, 'workspaces'),
        fetch: getFetchImplementation(options.fetch),
        apiKey,
        trace,
        clientName: options.clientName,
        xataAgentExtra: options.xataAgentExtra,
        clientID
      };

      return new Proxy(this, {
        get: (_target, namespace: keyof typeof operationsByTag) => {
          if (operationsByTag[namespace] === undefined) {
            return undefined;
          }

          return new Proxy(
            {},
            {
              get: (_target, operation: keyof (typeof operationsByTag)[keyof typeof operationsByTag]) => {
                if (operationsByTag[namespace][operation] === undefined) {
                  return undefined;
                }

                const method = operationsByTag[namespace][operation] as any;

                return async (params: Record<string, unknown>) => {
                  return await method({ ...params, ...extraProps });
                };
              }
            }
          );
        }
      });
    }
  } as unknown as { new (options?: XataApiClientOptions): XataApiProxy };

export class XataApiClient extends buildApiClient() {}
