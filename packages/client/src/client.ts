import { ApiExtraProps, HostProvider, Schemas } from './api';
import { FilesPlugin, FilesPluginResult } from './files';
import { XataPlugin, XataPluginOptions } from './plugins';
import { BaseSchema, SchemaPlugin, SchemaPluginResult, XataRecord } from './schema';
import { defaultTrace, TraceFunction } from './schema/tracing';
import { SearchPlugin, SearchPluginResult } from './search';
import { SQLPlugin, SQLPluginResult } from './sql';
import { TransactionPlugin, TransactionPluginResult } from './transaction';
import { FetchImpl, getFetchImplementation } from './util/fetch';
import { AllRequired, StringKeys } from './util/types';
import { generateUUID } from './util/uuid';

export type BaseClientOptions = {
  fetch?: FetchImpl;
  host?: HostProvider;
  apiKey?: string;
  databaseURL?: string;
  branch?: string;
  trace?: TraceFunction;
  enableBrowser?: boolean;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
};

type SafeOptions = AllRequired<Omit<BaseClientOptions, 'clientName' | 'xataAgentExtra'>> & {
  host: HostProvider;
  clientID: string;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
};

export const buildClient = <Plugins extends Record<string, XataPlugin> = {}>(plugins?: Plugins) =>
  class {
    #options: SafeOptions;

    schema: Schemas.Schema;
    db: SchemaPluginResult<any>;
    search: SearchPluginResult<any>;
    transactions: TransactionPluginResult<any>;
    sql: SQLPluginResult;
    files: FilesPluginResult<any>;

    constructor(options: BaseClientOptions = {}, tables: Schemas.Table[]) {
      const safeOptions = this.#parseOptions(options);
      this.#options = safeOptions;

      const pluginOptions: XataPluginOptions = {
        ...this.#getFetchProps(safeOptions),
        host: safeOptions.host,
        tables,
        branch: safeOptions.branch
      };

      const db = new SchemaPlugin().build(pluginOptions);
      const search = new SearchPlugin(db).build(pluginOptions);
      const transactions = new TransactionPlugin().build(pluginOptions);
      const sql = new SQLPlugin().build(pluginOptions);
      const files = new FilesPlugin().build(pluginOptions);

      // We assign the namespaces after creating in case the user overrides the db plugin
      this.schema = { tables };
      this.db = db;
      this.search = search;
      this.transactions = transactions;
      this.sql = sql;
      this.files = files;

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
      const enableBrowser = options?.enableBrowser ?? false;
      // @ts-ignore Window, Deno are not globals
      const isBrowser = typeof window !== 'undefined' && typeof Deno === 'undefined';
      if (isBrowser && !enableBrowser) {
        throw new Error(
          'You are trying to use Xata from the browser, which is potentially a non-secure environment. How to fix: https://xata.io/docs/messages/api-key-browser-error'
        );
      }

      const fetch = getFetchImplementation(options?.fetch);
      const databaseURL = options?.databaseURL;
      const apiKey = options?.apiKey;
      const branch = options?.branch;
      const trace = options?.trace ?? defaultTrace;
      const clientName = options?.clientName;
      const host = options?.host ?? 'production';
      const xataAgentExtra = options?.xataAgentExtra;

      if (!apiKey) {
        throw new Error('Option apiKey is required');
      }

      if (!databaseURL) {
        throw new Error('Option databaseURL is required');
      }

      if (!branch) {
        throw new Error('Option branch is required');
      }

      return {
        fetch,
        databaseURL,
        apiKey,
        branch,
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
      return {
        fetch,
        apiKey,
        apiUrl: '',
        // Instead of using workspace and dbBranch, we inject a probably CNAME'd URL
        workspacesApiUrl: (path, params) => {
          const hasBranch = params.dbBranchName ?? params.branch;
          const newPath = path.replace(/^\/db\/[^/]+/, hasBranch !== undefined ? `:${branch}` : '');
          return databaseURL + newPath;
        },
        trace,
        clientID,
        clientName,
        xataAgentExtra
      };
    }
  } as unknown as ClientConstructor<Plugins>;

export interface ClientConstructor<Plugins extends Record<string, XataPlugin>> {
  new <Schemas extends Record<string, XataRecord> = {}>(
    options?: Partial<BaseClientOptions>,
    schemaTables?: readonly BaseSchema[]
  ): Omit<
    {
      db: Awaited<ReturnType<SchemaPlugin<Schemas>['build']>>;
      search: Awaited<ReturnType<SearchPlugin<Schemas>['build']>>;
      transactions: Awaited<ReturnType<TransactionPlugin<Schemas>['build']>>;
      sql: Awaited<ReturnType<SQLPlugin['build']>>;
      files: Awaited<ReturnType<FilesPlugin<Schemas>['build']>>;
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
