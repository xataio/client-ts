import {
  Assume,
  Logger,
  NoopLogger,
  Query,
  RelationalSchemaConfig,
  TablesRelationalConfig,
  entityKind,
  fillPlaceholders
} from 'drizzle-orm';
import {
  PgDialect,
  PgSession,
  PgTransactionConfig,
  PreparedQuery,
  PreparedQueryConfig,
  QueryResultHKT,
  SelectedFieldsOrdered
} from 'drizzle-orm/pg-core';
import { XataClient } from './driver';
import { mapResultRow } from './utils';

type QueryResult<T = Record<string, unknown>> = {
  records: T[];
  warning?: string;
};

export class XataPreparedQuery<T extends PreparedQueryConfig> extends PreparedQuery<T> {
  static readonly [entityKind]: string = 'VercelPgPreparedQuery';

  private query: {
    name: string | undefined;
    statement: string;
  };

  constructor(
    private client: XataClient,
    queryString: string,
    private params: unknown[],
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    name: string | undefined,
    private customResultMapper?: (rows: unknown[][]) => T['execute']
  ) {
    super();

    this.query = {
      name,
      statement: queryString
    };
  }

  async execute(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['execute']> {
    const params = fillPlaceholders(this.params, placeholderValues);

    this.logger.logQuery(this.query.statement, params);

    const { records = [], warning } = await this.client.sql<Record<string, unknown>>({
      statement: this.query.statement,
      params
    });

    // FIXME: This is a hack, we should be able to get the fields from the query but SELECT * fails
    const fields =
      this.fields ??
      Object.keys(records[0]!).map(
        (key) =>
          ({
            path: [key],
            field: {
              sql: {
                decoder: {
                  mapFromDriverValue: (value: unknown) => value
                }
              }
            }
          } as any)
      );

    if (warning) console.warn(warning);
    const internalColumnNames = ['xata.version', 'xata.createdAt', 'xata.updatedAt', 'xata.deletedAt'];
    const rows = records.map((record) =>
      fields.map((field) => {
        const pathAsString = field.path.join('.');
        if (internalColumnNames.includes(pathAsString)) {
          const [namespaceXata, namespaceColumn]: [string, string] = pathAsString.split('.');
          return (record[namespaceXata] as Record<string, any>)[namespaceColumn];
        }
        return record[pathAsString];
      })
    );

    if (this.customResultMapper) {
      return this.customResultMapper(rows);
    }

    return rows.map((row) => mapResultRow<T['execute']>(fields, row, undefined));
  }

  async all(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['all']> {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.query.statement, params);

    const { records } = await this.client.sql({
      statement: this.query.statement,
      params
    });

    return records;
  }

  async values(placeholderValues: Record<string, unknown> | undefined = {}): Promise<T['values']> {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.query.statement, params);

    const { records } = await this.client.sql({
      statement: this.query.statement,
      params
    });

    return records;
  }
}

export interface XataSessionOptions {
  logger?: Logger;
}

export class XataSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends PgSession<XataQueryResultHKT, TFullSchema, TSchema> {
  static readonly [entityKind]: string = 'VercelPgSession';

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
    fields: SelectedFieldsOrdered | undefined,
    name: string | undefined,
    customResultMapper?: (rows: unknown[][]) => T['execute']
  ): PreparedQuery<T> {
    return new XataPreparedQuery(this.client, query.sql, query.params, this.logger, fields, name, customResultMapper);
  }

  async query(query: string, params: unknown[]): Promise<QueryResult> {
    this.logger.logQuery(query, params);
    return await this.client.sql({ statement: query, params });
  }

  async queryObjects<T extends Record<string, unknown>>(query: string, params: unknown[]): Promise<QueryResult<T>> {
    return this.client.sql({ statement: query, params });
  }

  override async transaction<T>(
    _transaction: (tx: any) => Promise<T>,
    _config?: PgTransactionConfig | undefined
  ): Promise<T> {
    throw new Error('Transactions are not supported');
  }
}

export interface XataQueryResultHKT extends QueryResultHKT {
  type: QueryResult<Assume<this['row'], Record<string, unknown>>[]>;
}
