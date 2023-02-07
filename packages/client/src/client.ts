import { ApiExtraProps, HostProvider, Schemas } from './api';
import { XataPlugin, XataPluginOptions } from './plugins';
import { BaseSchema, SchemaPlugin, SchemaPluginResult, XataRecord } from './schema';
import { CacheImpl, SimpleCache } from './schema/cache';
import { defaultTrace, TraceFunction } from './schema/tracing';
import { SearchPlugin, SearchPluginResult } from './search';
import { TransactionPlugin, TransactionPluginResult } from './transaction';
import { BranchStrategy, BranchStrategyOption, BranchStrategyValue, isBranchStrategyBuilder } from './util/branches';
import { getAPIKey, getDatabaseURL, getEnableBrowserVariable } from './util/environment';
import { FetchImpl, getFetchImplementation } from './util/fetch';
import { AllRequired, StringKeys } from './util/types';
import { generateUUID } from './util/uuid';

export type BaseClientOptions = {
  fetch?: FetchImpl;
  host?: HostProvider;
  apiKey?: string;
  databaseURL?: string;
  branch?: BranchStrategyOption;
  cache?: CacheImpl;
  trace?: TraceFunction;
  enableBrowser?: boolean;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
};

type SafeOptions = AllRequired<Omit<BaseClientOptions, 'branch' | 'clientName' | 'xataAgentExtra'>> & {
  branch?: string;
  clientID: string;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export const buildClient = <Plugins extends Record<string, XataPlugin> = {}>(plugins?: Plugins) =>
  class {
    #branch: BranchStrategyValue;
    #options: SafeOptions;

    db: SchemaPluginResult<any>;
    search: SearchPluginResult<any>;
    transactions: TransactionPluginResult<any>;

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
      const transactions = new TransactionPlugin().build(pluginOptions);

      // We assign the namespaces after creating in case the user overrides the db plugin
      this.db = db;
      this.search = search;
      this.transactions = transactions;

      for (const [key, namespace] of Object.entries(plugins ?? {})) {
        if (namespace === undefined) continue;

        // @ts-ignore
        this[key] = namespace.build(pluginOptions);
      }
    }

    public async getConfig() {
      const databaseURL = this.#options.databaseURL;
      const branch = this.#options.branch;

      return { databaseURL, branch };
    }

    #parseOptions(options?: BaseClientOptions): SafeOptions {
      // If is running from the browser and the user didn't pass `enableBrowser` we throw an error
      const enableBrowser = options?.enableBrowser ?? getEnableBrowserVariable() ?? false;
      // @ts-ignore Window, Deno are not globals
      const isBrowser = typeof window !== 'undefined' && typeof Deno === 'undefined';
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
      const clientName = options?.clientName;
      const host = options?.host ?? 'production';
      const xataAgentExtra = options?.xataAgentExtra;

      // We default to main if the user didn't pass a branch
      const branch = options?.branch !== undefined ? this.#evaluateBranch(options.branch) : 'main';

      if (!apiKey) {
        throw new Error('Option apiKey is required');
      }

      if (!databaseURL) {
        throw new Error('Option databaseURL is required');
      }

      return {
        fetch,
        databaseURL,
        apiKey,
        branch,
        cache,
        trace,
        host,
        clientID: generateUUID(),
        enableBrowser,
        clientName,
        xataAgentExtra
      };
    }

    #getFetchProps({
      fetch,
      apiKey,
      databaseURL,
      branch,
      trace,
      clientID,
      clientName,
      xataAgentExtra
    }: SafeOptions): ApiExtraProps {
      const branchValue = this.#evaluateBranch(branch);
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
        clientID,
        clientName,
        xataAgentExtra
      };
    }

    #evaluateBranch(param?: BranchStrategyOption): string | undefined {
      if (this.#branch) return this.#branch;
      if (param === undefined) return undefined;

      const strategies = Array.isArray(param) ? [...param] : [param];

      const evaluateBranch = (strategy: BranchStrategy) => {
        return isBranchStrategyBuilder(strategy) ? strategy() : strategy;
      };

      for (const strategy of strategies) {
        const branch = evaluateBranch(strategy);
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
      transactions: Awaited<ReturnType<TransactionPlugin<Schemas>['build']>>;
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
