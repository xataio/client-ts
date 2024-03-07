import { HostProvider, parseWorkspacesUrlParts, sqlQuery } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { isObject, isString } from '../util/lang';
import { prepareParams } from './parameters';

export type SQLQueryParams<T = any[]> = {
  /**
   * The SQL statement to execute.
   * @example
   * ```ts
   * const { records } = await xata.sql<TeamsRecord>({
   *  statement: `SELECT * FROM teams WHERE name = $1`,
   *  params: ['A name']
   * });
   * ```
   *
   * Be careful when using this with user input and use parametrized statements to avoid SQL injection.
   */
  statement: string;
  /**
   * The parameters to pass to the SQL statement.
   */
  params?: T;
  /**
   * The consistency level to use when executing the query.
   */
  consistency?: 'strong' | 'eventual';
  /**
   * The response type to use when executing the query.
   */
  responseType?: 'json' | 'array';
};

export type SQLQuery = TemplateStringsArray | SQLQueryParams;

type SQLResponseType = 'json' | 'array';

type SQLQueryResultJSON<T> = {
  /**
   * The records returned by the query.
   */
  records: T[];
  /**
   * The columns metadata returned by the query.
   */
  columns: Array<{ name: string; type: string }>;
  /**
   * Optional warning message returned by the query.
   */
  warning?: string;
};

type SQLQueryResultArray = {
  /**
   * The records returned by the query.
   */
  rows: any[][];
  /**
   * The columns metadata returned by the query.
   */
  columns: Array<{ name: string; type: string }>;
  /**
   * Optional warning message returned by the query.
   */
  warning?: string;
};

export type SQLQueryResult<T, Mode extends SQLResponseType = 'json'> = Mode extends 'json'
  ? SQLQueryResultJSON<T>
  : Mode extends 'array'
  ? SQLQueryResultArray
  : never;

type SQLPluginFunction = <T, Query extends SQLQuery = SQLQuery>(
  query: Query,
  ...parameters: any[]
) => Promise<
  SQLQueryResult<
    T,
    Query extends SQLQueryParams<any>
      ? Query['responseType'] extends SQLResponseType
        ? NonNullable<Query['responseType']>
        : 'json'
      : 'json'
  >
>;

export type SQLPluginResult = SQLPluginFunction & {
  /**
   * Connection string to use when connecting to the database.
   * It includes the workspace, region, database and branch.
   * Connects with the same credentials as the Xata client.
   */
  connectionString: string;
};

export class SQLPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions): SQLPluginResult {
    const sqlFunction = async (query: SQLQuery, ...parameters: any[]) => {
      if (!isParamsObject(query) && (!isTemplateStringsArray(query) || !Array.isArray(parameters))) {
        throw new Error('Invalid usage of `xata.sql`. Please use it as a tagged template or with an object.');
      }

      const { statement, params, consistency } = prepareParams(query, parameters);

      const {
        records,
        rows,
        warning,
        columns = []
      } = await sqlQuery({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
        body: { statement, params, consistency },
        ...pluginOptions
      });

      return { records, rows, warning, columns } as any;
    };

    sqlFunction.connectionString = buildConnectionString(pluginOptions);

    return sqlFunction;
  }
}

function isTemplateStringsArray(strings: unknown): strings is TemplateStringsArray {
  // @ts-ignore TS prior to 4.9 don't have this type
  return Array.isArray(strings) && 'raw' in strings && Array.isArray(strings.raw);
}

function isParamsObject(params: unknown): params is SQLQueryParams {
  return isObject(params) && 'statement' in params;
}

function buildDomain(host: HostProvider, region: string): string {
  switch (host) {
    case 'production':
      return `${region}.sql.xata.sh`;
    case 'staging':
      return `${region}.sql.staging-xata.dev`;
    case 'dev':
      return `${region}.sql.dev-xata.dev`;
    case 'local':
      return 'localhost:7654';
    default:
      throw new Error('Invalid host provider');
  }
}

function buildConnectionString({ apiKey, workspacesApiUrl, branch }: XataPluginOptions): string {
  const url = isString(workspacesApiUrl) ? workspacesApiUrl : workspacesApiUrl('', {});
  const parts = parseWorkspacesUrlParts(url);
  if (!parts) throw new Error('Invalid workspaces URL');

  const { workspace: workspaceSlug, region, database, host } = parts;
  const domain = buildDomain(host, region);
  const workspace = workspaceSlug.split('-').pop();

  if (!workspace || !region || !database || !apiKey || !branch) {
    throw new Error('Unable to build xata connection string');
  }

  return `postgresql://${workspace}:${apiKey}@${domain}/${database}:${branch}?sslmode=require`;
}
