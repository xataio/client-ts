import {
  CompiledQuery,
  DatabaseConnection,
  DatabaseIntrospector,
  Dialect,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryCompiler,
  QueryResult
} from 'kysely';
import { SQLPluginResult } from '../sql';

export type XataDialectConfig = {
  xata: { sql: SQLPluginResult };
};

export class XataDialect implements Dialect {
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

export class XataDriver implements Driver {
  constructor(private config: XataDialectConfig) {}

  async init(): Promise<void> {
    // noop
  }

  acquireConnection(): Promise<DatabaseConnection> {
    return Promise.resolve(new XataConnection(this.config));
  }

  // @ts-expect-error
  beginTransaction(): Promise<void> {}

  // @ts-expect-error
  commitTransaction(): Promise<void> {}

  // @ts-expect-error
  rollbackTransaction(): Promise<void> {}

  async releaseConnection(_conn: XataConnection): Promise<void> {
    // noop
  }

  async destroy(): Promise<void> {
    // noop
  }
}

export class XataConnection implements DatabaseConnection {
  #config: XataDialectConfig;

  constructor(config: XataDialectConfig) {
    this.#config = config;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql } = this.#config.xata;
    const { sql: statement, parameters } = compiledQuery;

    const { records, warning } = await sql({ statement, params: parameters as any[] });
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
