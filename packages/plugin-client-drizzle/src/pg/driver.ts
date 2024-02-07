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
import type { XataClient, XataQueryResultHKT } from './session.js';
import { XataSession } from './session.js';
import { PgDatabase, PgDialect } from 'drizzle-orm/pg-core';

export interface XataDriverOptions {
  logger?: Logger;
}

export class XataDriver {
  static readonly [entityKind]: string = 'XataDriver';

  constructor(private client: XataClient, private dialect: PgDialect, private options: XataDriverOptions = {}) {
    this.initMappers();
  }

  createSession(
    schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined
  ): XataSession<Record<string, unknown>, TablesRelationalConfig> {
    return new XataSession(this.client, this.dialect, schema, {
      logger: this.options.logger
    });
  }

  initMappers() {
    // TODO: Add custom type parsers
  }
}

export type XataDatabase<TSchema extends Record<string, unknown> = Record<string, never>> = PgDatabase<
  XataQueryResultHKT,
  TSchema
>;

export function drizzle<TSchema extends Record<string, unknown> = Record<string, never>>(
  client: XataClient,
  config: DrizzleConfig<TSchema> = {}
): XataDatabase<TSchema> {
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

  const driver = new XataDriver(client, dialect, { logger });
  const session = driver.createSession(schema);
  return new PgDatabase(dialect, session, schema) as XataDatabase<TSchema>;
}
