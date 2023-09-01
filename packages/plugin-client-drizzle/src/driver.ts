import { SQLPluginResult } from '@xata.io/client';
import {
  DefaultLogger,
  DrizzleConfig,
  RelationalSchemaConfig,
  TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig
} from 'drizzle-orm';
import { PgDatabase, PgDialect } from 'drizzle-orm/pg-core';
import { XataQueryResultHKT, XataSession } from './session';

export type XataDatabase<TSchema extends Record<string, unknown> = Record<string, never>> = PgDatabase<
  XataQueryResultHKT,
  TSchema
>;

export type XataClient = {
  sql: SQLPluginResult;
};

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

  const session = new XataSession(client, dialect, schema, { logger });
  return new PgDatabase(dialect, session, schema) as XataDatabase<TSchema>;
}
