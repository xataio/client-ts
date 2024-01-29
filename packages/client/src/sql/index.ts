import { sqlQuery } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { isObject } from '../util/lang';
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
};

export type SQLQuery = TemplateStringsArray | SQLQueryParams;

export type SQLQueryResult<T> = {
  /**
   * The records returned by the query.
   */
  records: T[];
  /**
   * The columns metadata returned by the query.
   */
  columns?: Record<string, { type_name: string }>;
  /**
   * Optional warning message returned by the query.
   */
  warning?: string;
};

export type SQLPluginResult = <T>(query: SQLQuery, ...parameters: any[]) => Promise<SQLQueryResult<T>>;

export class SQLPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions): SQLPluginResult {
    return async <T>(query: SQLQuery, ...parameters: any[]) => {
      if (!isParamsObject(query) && (!isTemplateStringsArray(query) || !Array.isArray(parameters))) {
        throw new Error('Invalid usage of `xata.sql`. Please use it as a tagged template or with an object.');
      }

      const { statement, params, consistency } = prepareParams(query, parameters);

      const { records, warning, columns } = await sqlQuery({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
        body: { statement, params, consistency },
        ...pluginOptions
      });

      return { records: records as T[], warning, columns };
    };
  }
}

function isTemplateStringsArray(strings: unknown): strings is TemplateStringsArray {
  // @ts-ignore TS prior to 4.9 don't have this type
  return Array.isArray(strings) && 'raw' in strings && Array.isArray(strings.raw);
}

function isParamsObject(params: unknown): params is SQLQueryParams {
  return isObject(params) && 'statement' in params;
}
