import { SQLPluginResult, SQLQueryResult } from '@xata.io/client';
import {
  Logger,
  NoopLogger,
  Query,
  RelationalSchemaConfig,
  SelectedFieldsOrdered,
  TablesRelationalConfig,
  entityKind,
  fillPlaceholders
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
import { mapResultRow } from '../shared/utils';

export type XataHttpClient = {
  sql: SQLPluginResult;
};

export class XataHttpPreparedQuery<T extends PreparedQueryConfig> extends PreparedQuery<T> {
  static readonly [entityKind]: string = 'XataHttpPreparedQuery';

  constructor(
    private client: XataHttpClient,
    private queryString: string,
    private params: unknown[],
    private logger: Logger,
    private fields: SelectedFieldsOrdered<PgColumn> | undefined,
    private name: string | undefined,
    private customResultMapper?: (rows: unknown[][]) => T['execute']
  ) {
    super();
  }

  async execute(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['execute']> {
    const params = fillPlaceholders(this.params, placeholderValues);

    this.logger.logQuery(this.queryString, params);

    const { fields, client, queryString, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      return client.sql({ statement: queryString, params });
    }

    const result = await client.sql({ statement: queryString, params });

    // @ts-expect-error joinsNotNullableMap is internal
    const joinsNotNullableMap = this.joinsNotNullableMap;

    return customResultMapper
      ? customResultMapper(result.records as unknown[][])
      : result.records.map((row) => mapResultRow<T['execute']>(fields!, row as unknown[], joinsNotNullableMap));
  }

  all(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['all']> {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.queryString, params);
    return this.client.sql({ statement: this.queryString, params }).then((result) => result.records);
  }

  values(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['values']> {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.queryString, params);
    return this.client.sql({ statement: this.queryString, params }).then((result) => result.records);
  }
}

export interface XataHttpSessionOptions {
  logger?: Logger;
}

export class XataHttpSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends PgSession<XataHttpQueryResultHKT, TFullSchema, TSchema> {
  static readonly [entityKind]: string = 'XataHttpSession';

  private logger: Logger;

  constructor(
    private client: XataHttpClient,
    dialect: PgDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private options: XataHttpSessionOptions = {}
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
    return new XataHttpPreparedQuery(
      this.client,
      query.sql,
      query.params,
      this.logger,
      fields,
      name,
      customResultMapper
    );
  }

  async query(query: string, params: unknown[]): Promise<SQLQueryResult<unknown>> {
    this.logger.logQuery(query, params);
    const result = await this.client.sql({ statement: query, params });
    return result;
  }

  async queryObjects(query: string, params: unknown[]): Promise<SQLQueryResult<unknown>> {
    return this.client.sql({ statement: query, params });
  }

  override async transaction<T>(
    _transaction: (tx: XataTransaction<TFullSchema, TSchema>) => Promise<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: PgTransactionConfig = {}
  ): Promise<T> {
    throw new Error('No transactions support in xata-http driver');
  }
}

export class XataTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends PgTransaction<XataHttpQueryResultHKT, TFullSchema, TSchema> {
  static readonly [entityKind]: string = 'XataHttpTransaction';

  override async transaction<T>(_transaction: (tx: XataTransaction<TFullSchema, TSchema>) => Promise<T>): Promise<T> {
    throw new Error('No transactions support in xata-http driver');
  }
}

export interface XataHttpQueryResultHKT extends QueryResultHKT {
  type: SQLQueryResult<unknown>;
}
