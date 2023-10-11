import type { DriverAdapter, Query, Queryable, Result, ResultSet, Transaction } from '@prisma/driver-adapter-utils';
import { Debug, ok } from '@prisma/driver-adapter-utils';
import { Responses, SQLPluginResult } from '@xata.io/client';
import { fieldToColumnType } from './conversion';

const debug = Debug('prisma:driver-adapter:xata');

type PerformIOResult = Responses.SQLResponse;

abstract class XataQueryable implements Queryable {
  readonly flavour = 'postgres';

  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]';
    debug(`${tag} %O`, query);

    const response = await this.performIO(query);

    return response.map(({ records = [], warning }) => {
      if (warning) {
        debug(`${tag} warning: %O`, warning);
      }

      return {
        columnNames: Object.keys(records[0] ?? {}),
        columnTypes: Object.values(records[0] ?? {}).map((v) => fieldToColumnType(v.type)),
        rows: records.map((r) => Object.values(r))
      };
    });
  }

  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]';
    debug(`${tag} %O`, query);

    // Note: `rowsAffected` can sometimes be null (e.g., when executing `"BEGIN"`)
    return (await this.performIO(query)).map((r) => r.records?.length ?? 0);
  }

  abstract performIO(query: Query): Promise<Result<PerformIOResult>>;
}

type XataClient = { sql: SQLPluginResult };

export class PrismaXataHTTP extends XataQueryable implements DriverAdapter {
  constructor(private client: XataClient) {
    super();
  }

  override async performIO(query: Query): Promise<Result<PerformIOResult>> {
    const result = await this.client.sql({ statement: query.sql, params: query.args });
    return ok(result as Responses.SQLResponse);
  }

  startTransaction(): Promise<Result<Transaction>> {
    return Promise.reject(new Error('Transactions are not supported in HTTP mode'));
  }

  async close() {
    return ok(undefined);
  }
}
