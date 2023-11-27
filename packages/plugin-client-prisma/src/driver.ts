/* eslint-disable @typescript-eslint/require-await */
import type {
  ColumnType,
  DriverAdapter,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction
} from '@prisma/driver-adapter-utils';
import { Debug, err, ok } from '@prisma/driver-adapter-utils';
import { Responses, SQLPluginResult } from '@xata.io/client';
import { fieldToColumnType } from './conversion';

const debug = Debug('prisma:driver-adapter:xata');

type PerformIOResult = Responses.SQLResponse;

abstract class XataQueryable implements Queryable {
  readonly flavour = 'postgres';

  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]';
    debug(`${tag} %O`, query);

    const res = await this.performIO(query);

    if (!res.ok) {
      return err(res.error);
    }

    const { records, columns = {}, warning } = res.value;
    if (warning) debug(`${tag} %O`, warning);

    const [columnNames, columnTypes] = Object.fromEntries(columns as any).reduce(
      ([names, types]: [string[], ColumnType[]], [name, { type_name }]: [string, { type_name: string }]) => {
        names.push(name);
        types.push(fieldToColumnType(type_name));
        return [names, types];
      },
      [[], []] as [string[], ColumnType[]]
    );

    return ok({ columnNames, columnTypes, rows: records as any[] });
  }

  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]';
    debug(`${tag} %O`, query);

    return (await this.performIO(query)).map((r) => r.total ?? 0);
  }

  abstract performIO(query: Query): Promise<Result<PerformIOResult>>;
}

type XataClient = { sql: SQLPluginResult };

export class PrismaXataHTTP extends XataQueryable implements DriverAdapter {
  constructor(private xata: XataClient) {
    super();
  }

  override async performIO(query: Query): Promise<Result<PerformIOResult>> {
    const { sql, args: values } = query;
    return ok(await this.xata.sql(sql, values, { arrayMode: true, fullResults: true }));
  }

  startTransaction(): Promise<Result<Transaction>> {
    return Promise.reject(new Error('Transactions are not supported in HTTP mode'));
  }

  async close() {
    return ok(undefined);
  }
}
