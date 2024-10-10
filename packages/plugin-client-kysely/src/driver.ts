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

export type XataDialectConfig = {
  xata: { sql: any };
  /**
   * The consistency level to use when reading data.
   * @default 'strong'
   */
  consistency?: 'strong' | 'eventual';
  postgresConnectionString?: string;
};

export class XataDialect implements Dialect {
  constructor(private config: XataDialectConfig) {}

  createAdapter() {
    if (this.config.postgresConnectionString) {
      return new PostgresAdapter();
    }
    return new XataAdapter();
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

export class XataConnection implements DatabaseConnection {
  #config: XataDialectConfig;

  constructor(config: XataDialectConfig) {
    this.#config = config;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql } = this.#config.xata;
    const { sql: statement, parameters } = compiledQuery;

    if (this.#config.postgresConnectionString) {
      const { Client } = require('pg');
      const client = new Client({ connectionString: this.#config.postgresConnectionString });
      await client.connect();
      const res = await client.query(statement, parameters);
      await client.end();

      return {
        rows: res.rows as O[],
        columns: res.fields,
        numAffectedRows: BigInt(res.rowCount),
        numUpdatedOrDeletedRows: BigInt(res.rowCount)
      };
    }

    const { records, warning, columns } = await sql({
      statement,
      params: parameters as any[],
      consistency: this.#config.consistency
    });
    if (warning) {
      console.warn(warning);
    }

    const numAffectedRows = BigInt(records.length);

    return {
      rows: records as O[],
      columns,
      numAffectedRows,
      numUpdatedOrDeletedRows: numAffectedRows
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<O>(_compiledQuery: CompiledQuery, _chunkSize: number): AsyncIterableIterator<QueryResult<O>> {
    throw new Error('Driver does not support streaming');
  }
}
