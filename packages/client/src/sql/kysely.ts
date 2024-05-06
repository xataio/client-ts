import {
  CompiledQuery,
  DatabaseConnection,
  DatabaseIntrospector,
  DeduplicateJoinsPlugin,
  Dialect,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryCompiler,
  QueryResult
} from 'kysely';
import { sqlQuery } from '../api';
import { XataPluginOptions } from '../plugins';

type XataDialectConfig = {
  run: (query: string, params: any[]) => Promise<{ records: any[]; warning?: string }>;
};

class XataDialect implements Dialect {
  constructor(private config: XataDialectConfig) {}

  createAdapter() {
    return new PostgresAdapter();
  }

  createDriver(): Driver {
    return new XataDriver(this.config);
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler();
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new PostgresIntrospector(db);
  }
}

class XataDriver implements Driver {
  constructor(private config: XataDialectConfig) {}

  async init(): Promise<void> {
    // noop
  }

  acquireConnection(): Promise<DatabaseConnection> {
    return Promise.resolve(new XataConnection(this.config));
  }

  beginTransaction(): Promise<void> {
    throw new Error('Transactions are not supported yet.');
  }

  commitTransaction(): Promise<void> {
    throw new Error('Transactions are not supported yet.');
  }

  rollbackTransaction(): Promise<void> {
    throw new Error('Transactions are not supported yet.');
  }

  async releaseConnection(_conn: XataConnection): Promise<void> {
    // noop
  }

  async destroy(): Promise<void> {
    // noop
  }
}

class XataConnection implements DatabaseConnection {
  #config: XataDialectConfig;

  constructor(config: XataDialectConfig) {
    this.#config = config;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql: statement, parameters } = compiledQuery;

    const { records, warning } = await this.#config.run(statement, parameters as any[]);
    if (warning) {
      console.warn(warning);
    }

    const numAffectedRows = BigInt(records.length);

    return {
      rows: records as O[],
      // @ts-ignore replaces `QueryResult.numUpdatedOrDeletedRows` in kysely > 0.22
      numAffectedRows,
      // deprecated in kysely > 0.22, keep for backward compatibility.
      numUpdatedOrDeletedRows: numAffectedRows
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<O>(_compiledQuery: CompiledQuery, _chunkSize: number): AsyncIterableIterator<QueryResult<O>> {
    throw new Error('Driver does not support streaming');
  }
}

export const kyselyDriver =
  ({ pluginOptions }: { pluginOptions: XataPluginOptions }) =>
  () => ({
    db: new Kysely<Record<string, any>>({
      dialect: new XataDialect({
        run: async (query, params) => {
          const { records = [] } = await sqlQuery({
            pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
            body: { statement: query, params },
            ...pluginOptions
          });
          return { records };
        }
      }),
      plugins: [new DeduplicateJoinsPlugin()]
    })
  });
