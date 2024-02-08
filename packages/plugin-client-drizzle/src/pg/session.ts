import {
  Assume,
  Logger,
  NoopLogger,
  Query,
  RelationalSchemaConfig,
  SelectedFieldsOrdered,
  TablesRelationalConfig,
  entityKind,
  fillPlaceholders,
  sql
} from 'drizzle-orm';
import {
  PgColumn,
  PgDialect,
  PgSession,
  PgTransaction,
  PgTransactionConfig,
  PreparedQuery,
  PreparedQueryConfig,
  QueryResultHKT
} from 'drizzle-orm/pg-core';
import { Client, Pool, PoolClient, QueryArrayConfig, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import { mapResultRow } from '../shared/utils';

export type XataClient = Pool | PoolClient | Client;

export class XataPreparedQuery<T extends PreparedQueryConfig> extends PreparedQuery<T> {
  static readonly [entityKind]: string = 'XataPreparedQuery';

  private rawQuery: QueryConfig;
  private query: QueryArrayConfig;

  constructor(
    private client: XataClient,
    queryString: string,
    private params: unknown[],
    private logger: Logger,
    private fields: SelectedFieldsOrdered<PgColumn> | undefined,
    name: string | undefined,
    private customResultMapper?: (rows: unknown[][]) => T['execute']
  ) {
    super();
    this.rawQuery = { name, text: queryString };
    this.query = { name, text: queryString, rowMode: 'array' };
  }

  async execute(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['execute']> {
    const params = fillPlaceholders(this.params, placeholderValues);

    this.logger.logQuery(this.rawQuery.text, params);

    const { fields, client, rawQuery, query, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      return await client.query(rawQuery, params);
    }

    const result = await client.query(query, params);

    // @ts-expect-error joinsNotNullableMap is internal
    const joinsNotNullableMap = this.joinsNotNullableMap;

    return customResultMapper
      ? customResultMapper(result.rows)
      : result.rows.map((row) => mapResultRow<T['execute']>(fields!, row, joinsNotNullableMap));
  }

  all(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['all']> {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.rawQuery.text, params);
    return this.client.query(this.rawQuery, params).then((result) => result.rows);
  }

  values(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['values']> {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.rawQuery.text, params);
    return this.client.query(this.query, params).then((result) => result.rows);
  }
}

export interface XataSessionOptions {
  logger?: Logger;
}

export class XataSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends PgSession<XataQueryResultHKT, TFullSchema, TSchema> {
  static readonly [entityKind]: string = 'XataSession';

  private logger: Logger;

  constructor(
    private client: XataClient,
    dialect: PgDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private options: XataSessionOptions = {}
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<T extends PreparedQueryConfig = PreparedQueryConfig>(
    query: Query,
    fields: SelectedFieldsOrdered<PgColumn> | undefined,
    name: string | undefined,
    customResultMapper?: (rows: unknown[][]) => T['execute']
  ): PreparedQuery<T> {
    return new XataPreparedQuery(this.client, query.sql, query.params, this.logger, fields, name, customResultMapper);
  }

  async query(query: string, params: unknown[]): Promise<QueryResult> {
    this.logger.logQuery(query, params);
    const result = await this.client.query({
      rowMode: 'array',
      text: query,
      values: params
    });
    return result;
  }

  async queryObjects<T extends QueryResultRow>(query: string, params: unknown[]): Promise<QueryResult<T>> {
    return await this.client.query<T>(query, params);
  }

  override async transaction<T>(
    transaction: (tx: XataTransaction<TFullSchema, TSchema>) => Promise<T>,
    config: PgTransactionConfig = {}
  ): Promise<T> {
    const session =
      this.client instanceof Pool
        ? new XataSession(await this.client.connect(), this.dialect, this.schema, this.options)
        : this;
    const tx = new XataTransaction(this.dialect, session, this.schema);
    // @ts-expect-error getTransactionConfigSQL is internal
    await tx.execute(sql`begin ${tx.getTransactionConfigSQL(config)}`);
    try {
      const result = await transaction(tx);
      await tx.execute(sql`commit`);
      return result;
    } catch (error) {
      await tx.execute(sql`rollback`);
      throw error;
    } finally {
      if (this.client instanceof Pool) {
        (session.client as PoolClient).release();
      }
    }
  }
}

export class XataTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends PgTransaction<XataQueryResultHKT, TFullSchema, TSchema> {
  static readonly [entityKind]: string = 'XataTransaction';

  override async transaction<T>(transaction: (tx: XataTransaction<TFullSchema, TSchema>) => Promise<T>): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    // @ts-expect-error session and dialect are internal
    const tx = new XataTransaction(this.dialect, this.session, this.schema, this.nestedIndex + 1);
    await tx.execute(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await tx.execute(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (e) {
      await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
      throw e;
    }
  }
}

export interface XataQueryResultHKT extends QueryResultHKT {
  type: QueryResult<Assume<this['row'], QueryResultRow>>;
}
