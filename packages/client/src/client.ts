import { ApiExtraProps, Schemas } from './api';
import { FetcherExtraProps, FetchImpl } from './api/fetcher';
import { XataPlugin, XataPluginOptions } from './plugins';
import { BaseSchema, SchemaPlugin, SchemaPluginResult, XataRecord } from './schema';
import { CacheImpl, SimpleCache } from './schema/cache';
import { defaultTrace, TraceFunction } from './schema/tracing';
import { SearchPlugin, SearchPluginResult } from './search';
import { getAPIKey } from './util/apiKey';
import { BranchStrategy, BranchStrategyOption, BranchStrategyValue, isBranchStrategyBuilder } from './util/branches';
import { getCurrentBranchName, getDatabaseURL } from './util/config';
import { getFetchImplementation } from './util/fetch';
import { AllRequired, StringKeys } from './util/types';
import { generateUUID } from './util/uuid';

export type BaseClientOptions = {
  fetch?: FetchImpl;
  apiKey?: string;
  databaseURL?: string;
  branch?: BranchStrategyOption;
  cache?: CacheImpl;
  trace?: TraceFunction;
  enableBrowser?: boolean;
};

type SafeOptions = AllRequired<Omit<BaseClientOptions, 'branch'>> & {
  branch: () => Promise<string | undefined>;
  clientID: string;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export const buildClient = <Plugins extends Record<string, XataPlugin> = {}>(plugins?: Plugins) =>
  class {
    #branch: BranchStrategyValue;
    #options: SafeOptions;

    db: SchemaPluginResult<any>;
    search: SearchPluginResult<any>;

    constructor(options: BaseClientOptions = {}, schemaTables?: Schemas.Table[]) {
      const safeOptions = this.#parseOptions(options);
      this.#options = safeOptions;

      const pluginOptions: XataPluginOptions = {
        getFetchProps: () => this.#getFetchProps(safeOptions),
        cache: safeOptions.cache,
        trace: safeOptions.trace
      };

      const db = new SchemaPlugin(schemaTables).build(pluginOptions);
      const search = new SearchPlugin(db, schemaTables).build(pluginOptions);

      // We assign the namespaces after creating in case the user overrides the db plugin
      this.db = db;
      this.search = search;

      for (const [key, namespace] of Object.entries(plugins ?? {})) {
        if (namespace === undefined) continue;
        const result = namespace.build(pluginOptions);

        if (result instanceof Promise) {
          void result.then((namespace: unknown) => {
            // @ts-ignore
            this[key] = namespace;
          });
        } else {
          // @ts-ignore
          this[key] = result;
        }
      }
    }

    public async getConfig() {
      const databaseURL = this.#options.databaseURL;
      const branch = await this.#options.branch();

      return { databaseURL, branch };
    }

    #parseOptions(options?: BaseClientOptions): SafeOptions {
      const enableBrowser = options?.enableBrowser ?? false;

      // If is running from the browser and the user didn't pass `enableBrowser` we throw an error
      // @ts-ignore Window is not defined in Node
      const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
      if (isBrowser && !enableBrowser) {
        throw new Error(
          'You are trying to use Xata from the browser, which is potentially a non-secure environment. If you understand the security concerns, such as leaking your credentials, pass `enableBrowser: true` to the client options to remove this error.'
        );
      }

      const fetch = getFetchImplementation(options?.fetch);
      const databaseURL = options?.databaseURL || getDatabaseURL();
      const apiKey = options?.apiKey || getAPIKey();
      const cache = options?.cache ?? new SimpleCache({ defaultQueryTTL: 0 });
      const trace = options?.trace ?? defaultTrace;
      const branch = async () =>
        options?.branch !== undefined
          ? await this.#evaluateBranch(options.branch)
          : await getCurrentBranchName({ apiKey, databaseURL, fetchImpl: options?.fetch });

      if (!apiKey) {
        throw new Error('Option apiKey is required');
      }

      if (!databaseURL) {
        throw new Error('Option databaseURL is required');
      }

      return { fetch, databaseURL, apiKey, branch, cache, trace, clientID: generateUUID(), enableBrowser };
    }

    async #getFetchProps({ fetch, apiKey, databaseURL, branch, trace, clientID }: SafeOptions): Promise<ApiExtraProps> {
      const branchValue = await this.#evaluateBranch(branch);
      if (!branchValue) throw new Error('Unable to resolve branch value');

      return {
        fetchImpl: fetch,
        apiKey,
        apiUrl: '',
        // Instead of using workspace and dbBranch, we inject a probably CNAME'd URL
        workspacesApiUrl: (path, params) => {
          const hasBranch = params.dbBranchName ?? params.branch;
          const newPath = path.replace(/^\/db\/[^/]+/, hasBranch !== undefined ? `:${branchValue}` : '');
          return databaseURL + newPath;
        },
        trace,
        clientID
      };
    }

    async #evaluateBranch(param?: BranchStrategyOption): Promise<string | undefined> {
      if (this.#branch) return this.#branch;
      if (param === undefined) return undefined;

      const strategies = Array.isArray(param) ? [...param] : [param];

      const evaluateBranch = async (strategy: BranchStrategy) => {
        return isBranchStrategyBuilder(strategy) ? await strategy() : strategy;
      };

      for await (const strategy of strategies) {
        const branch = await evaluateBranch(strategy);
        if (branch) {
          this.#branch = branch;
          return branch;
        }
      }
    }
  } as unknown as ClientConstructor<Plugins>;

export interface ClientConstructor<Plugins extends Record<string, XataPlugin>> {
  // eslint-disable-next-line @typescript-eslint/ban-types
  new <Schemas extends Record<string, XataRecord> = {}>(
    options?: Partial<BaseClientOptions>,
    schemaTables?: readonly BaseSchema[]
  ): Omit<
    {
      db: Awaited<ReturnType<SchemaPlugin<Schemas>['build']>>;
      search: Awaited<ReturnType<SearchPlugin<Schemas>['build']>>;
    },
    keyof Plugins
  > & {
    [Key in StringKeys<NonNullable<Plugins>>]: Awaited<ReturnType<NonNullable<Plugins>[Key]['build']>>;
  } & {
    getConfig(): Promise<{
      databaseURL: string;
      branch: string;
    }>;
  };
}

export class BaseClient extends buildClient()<Record<string, any>> {}
