import {
  DefaultLogger,
  DrizzleConfig,
  Logger,
  RelationalSchemaConfig,
  TablesRelationalConfig,
  createTableRelationsHelpers,
  entityKind,
  extractTablesRelationalConfig
} from 'drizzle-orm';
import { XataHttpSession, type XataHttpClient, type XataHttpQueryResultHKT } from './session.js';
import { PgDatabase, PgDialect } from 'drizzle-orm/pg-core';

export interface XataDriverOptions {
  logger?: Logger;
}

export class XataHttpDriver {
  static readonly [entityKind]: string = 'XataDriver';

  constructor(private client: XataHttpClient, private dialect: PgDialect, private options: XataDriverOptions = {}) {
    this.initMappers();
  }

  createSession(
    schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined
  ): XataHttpSession<Record<string, unknown>, TablesRelationalConfig> {
    return new XataHttpSession(this.client, this.dialect, schema, {
      logger: this.options.logger
    });
  }

  initMappers() {
    // TODO: Add custom type parsers
  }
}

export type XataHttpDatabase<TSchema extends Record<string, unknown> = Record<string, never>> = PgDatabase<
  XataHttpQueryResultHKT,
  TSchema
>;

export function drizzle<TSchema extends Record<string, unknown> = Record<string, never>>(
  client: XataHttpClient,
  config: DrizzleConfig<TSchema> = {}
): XataHttpDatabase<TSchema> {
  const dialect = new PgDialect();
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }

  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(config.schema, createTableRelationsHelpers);
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }

  const driver = new XataHttpDriver(client, dialect, { logger });
  const session = driver.createSession(schema);

  return new PgDatabase(dialect, session, schema) as XataHttpDatabase<TSchema>;
}
