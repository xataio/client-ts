import type { DriverAdapter, Query, Queryable, Result, ResultSet, Transaction } from '@prisma/driver-adapter-utils';
import { Debug, ok } from '@prisma/driver-adapter-utils';
import { Responses, SQLPluginResult, Schemas } from '@xata.io/client';
import { fieldToColumnType, xataToColumnTypeEnum } from './conversion';

const debug = Debug('prisma:driver-adapter:xata');

type PerformIOResult = Responses.SQLResponse & { table: Schemas.Table };

abstract class XataQueryable implements Queryable {
  readonly flavour = 'postgres';

  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]';
    debug(`${tag} %O`, query);

    const response = await this.performIO(query);

    return response.map(({ records = [], warning, table }) => {
      if (warning) {
        debug(`${tag} warning: %O`, warning);
      }
      if (!response.ok) {
        // TODO handle this more gracefully
        throw new Error();
      }

      const types: { [k: string]: number } = {};

      table.columns.forEach((column) => {
        types[column.name] = xataToColumnTypeEnum(column)!;
      });
      // Column names and types need to appear in the order they were in the query
      const sortedRecords = records.flatMap((record) => {
        const copy: { [key: string]: any } = {};
        orderRecordKeys({ appearanceIn: query.sql, record }).map((key) => {
          copy[key] = record[key];
        });
        return copy;
      });
      return {
        columnNames: sortedRecords.flatMap((record) => Object.keys(record)),
        columnTypes: sortedRecords.flatMap((record) =>
          Object.entries(record).map(([k, _v]) => fieldToColumnType(types[k]))
        ),
        rows: sortedRecords.map((record) => Object.values(record))
      };
    });
  }

  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]';
    debug(`${tag} % O`, query);

    // Note: `rowsAffected` can sometimes be null (e.g., when executing `"BEGIN"`)
    return (await this.performIO(query)).map((r) => r.records?.length ?? 0);
  }

  abstract performIO(query: Query): Promise<Result<PerformIOResult>>;
}

export type XataClient = { schema: Schemas.Schema; sql: SQLPluginResult };

export class PrismaXataHTTP extends XataQueryable implements DriverAdapter {
  #_tables: Schemas.Table[];
  constructor(private client: XataClient, _tables?: Schemas.Table[]) {
    super();
    this.#_tables = _tables ?? [];
  }

  override async performIO(query: Query): Promise<Result<PerformIOResult>> {
    const { formatted, table } = prepareSql(query, this.#_tables);
    const result = await this.client.sql({ statement: formatted, params: query.args });
    const resultFormatted = { ...result, table };
    return ok(resultFormatted);
  }

  startTransaction(): Promise<Result<Transaction>> {
    return Promise.reject(new Error('Transactions are not supported in HTTP mode'));
  }

  async close() {
    return ok(undefined);
  }
}

const orderRecordKeys = (params: { appearanceIn: string; record: Record<string, any> }) => {
  // Will break if column names are inside a string literal in the query
  let toCheck = params.appearanceIn;
  const divider = 'RETURNING';
  // If there is a returning clause we need to check the columns in the order they appear
  // instead of the order they were inserted/updated in
  if (params.appearanceIn.includes(divider)) {
    toCheck = params.appearanceIn.split(divider)[1];
  }
  const ordered = Object.keys(params.record).sort((a, b) => {
    return toCheck.indexOf(a) > toCheck.indexOf(b) ? 1 : -1;
  });
  return ordered;
};

// TODO any queries involving relations will not work. Xata Links are one sided so if you have
// User and post, with the link to post on User table
// You cannot get the post information without manipulation of the query.
const prepareSql = (query: Query, tables: Schemas.Table[]) => {
  // Xata client will throw error with a schema prefixed table name
  const formatted = query.sql.replaceAll('"public".', '');
  const tname = new RegExp(`${tables.map((t) => t.name).join('|')}`).exec(formatted)?.[0]; // First occurrence of table name
  const table = tables.find((t) => t.name === tname);
  // so we need to add it manually
  if (!table) throw new Error('Table not found');
  if (!table.id) {
    // Xata does not keep the ID as part of the table schema
    table.columns.push({ type: 'string', name: 'id' });
  }
  return { formatted, table };
};
