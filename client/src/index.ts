import { XataApi } from './api';
import { FetchImpl } from './api/xatabaseFetcher';
import { Schema } from './schema';

interface RepositoryFactory {
  createRepository<T>(client: BaseClient<any>, table: string): Schema<T>;
}

export class SchemaFactory implements RepositoryFactory {
  createRepository<T>(client: BaseClient<any>, table: string): Schema<T> {
    return new Schema<T>(client, table);
  }
}

export type XataClientOptions = {
  fetch?: FetchImpl;
  workspace?: string;
  database?: string;
  branch: BranchStrategyOption;
  apiKey: string;
  repositoryFactory?: RepositoryFactory;
};

export class BaseClient<D extends Record<string, Schema<any>> = any> {
  options: XataClientOptions;
  private links: Links;
  private branch: BranchStrategyValue;
  db!: D;

  constructor(options: XataClientOptions, links?: Links) {
    if (!options.workspace || !options.apiKey || !options.branch) {
      throw new Error('Options databaseURL, apiKey and branch are required');
    }

    this.options = options;
    this.links = links ?? {};
  }

  public initObject<T>(table: string, object: object) {
    const o: Record<string, unknown> = {};
    Object.assign(o, object);

    const tableLinks = this.links[table] || [];
    for (const link of tableLinks) {
      const [field, linkTable] = link;
      const value = o[field];

      if (value && typeof value === 'object') {
        const { id } = value as any;
        if (Object.keys(value).find((col) => col === 'id')) {
          o[field] = this.initObject(linkTable, value);
        } else if (id) {
          o[field] = {
            id,
            get: () => {
              this.db[linkTable].read(id);
            }
          };
        }
      }
    }

    const db = this.db;
    o.read = function () {
      return db[table].read(o['id'] as string);
    };
    o.update = function (data: any) {
      return db[table].update(o['id'] as string, data);
    };
    o.delete = function () {
      return db[table].delete(o['id'] as string);
    };

    for (const prop of ['read', 'update', 'delete']) {
      Object.defineProperty(o, prop, { enumerable: false });
    }

    // TODO: links and rev links

    Object.freeze(o);
    return o as T;
  }

  public async getWorkspaceId(): Promise<string> {
    if (!this.options.workspace) throw new Error('Workspace is not defined');
    return this.options.workspace;
  }

  public async getDatabaseId(): Promise<string> {
    if (!this.options.database) throw new Error('Database is not defined');
    return this.options.database;
  }

  public async getBranch(): Promise<string> {
    if (this.branch) return this.branch;

    const { branch: param } = this.options;
    const strategies = Array.isArray(param) ? [...param] : [param];

    const evaluateBranch = async (strategy: BranchStrategy) => {
      return isBranchStrategyBuilder(strategy) ? await strategy() : strategy;
    };

    for await (const strategy of strategies) {
      const branch = await evaluateBranch(strategy);
      if (branch) {
        this.branch = branch;
        return branch;
      }
    }

    throw new Error('Unable to resolve branch value');
  }

  public get api() {
    return new XataApi(this.options);
  }
}

export class XataError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Links = Record<string, Array<string[]>>;

type BranchStrategyValue = string | undefined | null;
type BranchStrategyBuilder = () => BranchStrategyValue | Promise<BranchStrategyValue>;
type BranchStrategy = BranchStrategyValue | BranchStrategyBuilder;
type BranchStrategyOption = NonNullable<BranchStrategy | BranchStrategy[]>;

const isBranchStrategyBuilder = (strategy: BranchStrategy): strategy is BranchStrategyBuilder => {
  return typeof strategy === 'function';
};

export * from './schema/operators';
export type { XataObject } from './schema/xataObject';
export { Schema };
