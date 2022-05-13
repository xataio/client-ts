import { FetcherExtraProps, FetchImpl } from './api/fetcher';
import { Namespace } from './namespace';
import { SchemaNamespace } from './schema';
import { SearchNamespace } from './search';
import { BranchStrategy, BranchStrategyOption, BranchStrategyValue, isBranchStrategyBuilder } from './util/branches';
import { getAPIKey, getCurrentBranchName, getDatabaseURL } from './util/config';
import { getFetchImplementation } from './util/fetch';

export class XataError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export * from './api';
export * from './schema';
export * from './util/config';

type XataClientOptions = {
  fetch?: FetchImpl;
  apiKey?: string;
  databaseURL?: string;
  branch?: BranchStrategyOption;
};
export class XataClient {
  #fetch: FetchImpl;
  #branch: BranchStrategyValue;

  constructor(private options: XataClientOptions = {}) {
    this.#fetch = getFetchImplementation(options.fetch);
  }

  async #getFetchProps(): Promise<FetcherExtraProps> {
    const branch = await this.#getBranch();

    const apiKey = this.options.apiKey ?? getAPIKey();

    if (!apiKey) {
      throw new Error('Could not resolve a valid apiKey');
    }

    return {
      fetchImpl: this.#fetch,
      apiKey,
      apiUrl: '',
      // Instead of using workspace and dbBranch, we inject a probably CNAME'd URL
      workspacesApiUrl: (path, params) => {
        const baseUrl = this.options.databaseURL ?? '';
        const hasBranch = params.dbBranchName ?? params.branch;
        const newPath = path.replace(/^\/db\/[^/]+/, hasBranch ? `:${branch}` : '');
        return baseUrl + newPath;
      }
    };
  }

  async #getBranch(): Promise<string> {
    if (this.#branch) return this.#branch;

    const { branch: param } = this.options;
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

    throw new Error('Unable to resolve branch value');
  }

  public build<Namespaces extends Record<string, Namespace>>(
    namespaces: Namespaces
  ): { [Key in keyof Namespaces]: ReturnType<Namespaces[Key]['build']> } {
    return Object.entries(namespaces).reduce(
      (acc, [key, namespace]) => ({
        ...acc,
        [key]: namespace.build({ getFetchProps: () => this.#getFetchProps() })
      }),
      {}
    ) as any;
  }
}

function resolveXataClientOptions(options?: Partial<XataClientOptions>): XataClientOptions {
  const databaseURL = options?.databaseURL || getDatabaseURL() || '';
  const apiKey = options?.apiKey || getAPIKey() || '';
  const branch = options?.branch || (() => getCurrentBranchName({ apiKey, databaseURL, fetchImpl: options?.fetch }));

  if (!databaseURL || !apiKey) {
    throw new Error('Options databaseURL and apiKey are required');
  }

  return {
    ...options,
    databaseURL,
    apiKey,
    branch
  };
}

type DatabaseTables = {
  users: { name: string };
};

const xata = new XataClient().build({
  db: new SchemaNamespace<DatabaseTables>({
    users: { table: 'users' }
  }),
  search: new SearchNamespace<DatabaseTables>()
});

/**
 * 
 *     this.db = new Proxy({} as D, {
      get: (_target, prop) => {
        if (!isString(prop)) throw new Error('Invalid table name');
        return factory.createRepository(this, prop, links);
      }
    });
 */
