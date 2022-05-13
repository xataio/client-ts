import { FetcherExtraProps, FetchImpl } from './api/fetcher';
import { Namespace } from './namespace';
import { SchemaNamespace } from './schema';
import { BaseData } from './schema/record';
import { LinkDictionary } from './schema/repository';
import { SearchNamespace } from './search';
import { BranchStrategy, BranchStrategyOption, isBranchStrategyBuilder } from './util/branches';
import { getAPIKey, getCurrentBranchName, getDatabaseURL } from './util/config';
import { getFetchImplementation } from './util/fetch';
import { StringKeys } from './util/types';

export type BaseClientOptions = {
  fetch: FetchImpl;
  apiKey: string;
  databaseURL: string;
  branch: BranchStrategyOption;
};

export const buildClientWithNamespaces =
  <ExternalNamespaces extends Record<string, Namespace>>(namespaces: ExternalNamespaces) =>
  <Schemas extends Record<string, BaseData>>() =>
    buildClient<Schemas, ExternalNamespaces>(namespaces);

export const buildClient = <
  Schemas extends Record<string, BaseData>,
  ExternalNamespaces extends Record<string, Namespace> = {},
  Namespaces extends Record<string, Namespace> = { db: SchemaNamespace<Schemas>; search: SearchNamespace<Schemas> }
>(
  external?: ExternalNamespaces
) =>
  class {
    constructor(options: Partial<BaseClientOptions> = {}, links?: LinkDictionary) {
      const safeOptions = this.#parseOptions(options);

      const namespaces = {
        db: new SchemaNamespace(links),
        search: new SearchNamespace(),
        ...external
      };

      for (const [key, namespace] of Object.entries(namespaces)) {
        if (!namespace) continue;
        // @ts-ignore
        this[key] = namespace.build({ getFetchProps: () => this.#getFetchProps(safeOptions) });
      }
    }

    #parseOptions(options?: Partial<BaseClientOptions>): BaseClientOptions {
      const fetch = getFetchImplementation(options?.fetch);
      const databaseURL = options?.databaseURL || getDatabaseURL();
      const apiKey = options?.apiKey || getAPIKey();
      const branch =
        options?.branch ?? (() => getCurrentBranchName({ apiKey, databaseURL, fetchImpl: options?.fetch }));

      if (!databaseURL || !apiKey) {
        throw new Error('Options databaseURL and apiKey are required');
      }

      return { fetch, databaseURL, apiKey, branch };
    }

    async #getFetchProps({ fetch, apiKey, databaseURL, branch }: BaseClientOptions): Promise<FetcherExtraProps> {
      return {
        fetchImpl: fetch,
        apiKey,
        apiUrl: '',
        // Instead of using workspace and dbBranch, we inject a probably CNAME'd URL
        workspacesApiUrl: (path, params) => {
          const hasBranch = params.dbBranchName ?? params.branch;
          const newPath = path.replace(/^\/db\/[^/]+/, hasBranch ? `:${branch}` : '');
          return databaseURL + newPath;
        }
      };
    }

    async #evaluateBranch(param?: BranchStrategyOption): Promise<string | undefined> {
      if (!param) return undefined;

      const strategies = Array.isArray(param) ? [...param] : [param];

      const evaluateBranch = async (strategy: BranchStrategy) => {
        return isBranchStrategyBuilder(strategy) ? await strategy() : strategy;
      };

      for await (const strategy of strategies) {
        const branch = await evaluateBranch(strategy);
        if (branch) return branch;
      }
    }
  } as unknown as WrapperConstructor<Schemas, Namespaces, ExternalNamespaces>;

interface WrapperConstructor<
  Schemas extends Record<string, BaseData> = Record<string, any>,
  Namespaces extends Record<string, Namespace> = { db: SchemaNamespace<Schemas>; search: SearchNamespace<Schemas> },
  ExternalNamespaces extends Record<string, Namespace> = Record<string, Namespace>
> {
  new (options?: Partial<BaseClientOptions>, links?: LinkDictionary): {
    [Key in StringKeys<Namespaces>]: ReturnType<Namespaces[Key]['build']>;
  } & {
    [Key in StringKeys<NonNullable<ExternalNamespaces>>]: ReturnType<NonNullable<ExternalNamespaces>[Key]['build']>;
  };
}

export class BaseClient extends buildClient<Record<string, any>>() {}
