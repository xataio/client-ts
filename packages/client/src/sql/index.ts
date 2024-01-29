import { sqlQuery } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { isObject } from '../util/lang';
import { prepareParams } from './parameters';

export type SQLQueryParams<T = any[]> = {
  statement: string;
  params?: T;
  consistency?: 'strong' | 'eventual';
};

export type SQLQuery = TemplateStringsArray | SQLQueryParams;

export type SQLQueryResult<T> = {
  records: T[];
  columns?: Record<string, { type_name: string }>;
  warning?: string;
};

type SQLTemplateQuery = <T>(query: SQLQuery, ...parameters: any[]) => Promise<SQLQueryResult<T>>;

export type SQLPluginResult = SQLTemplateQuery & {
  rawUnsafeQuery: <T>(query: SQLQuery | string, ...parameters: any[]) => Promise<SQLQueryResult<T>>;
};

export class SQLPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions): SQLPluginResult {
    const query = async <T>(query: SQLQuery | string, ...parameters: any[]) => {
      const { statement, params, consistency } = prepareParams(query, parameters);

      const { records, warning, columns } = await sqlQuery({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
        body: { statement, params, consistency },
        ...pluginOptions
      });

      return { records: records as T[], warning, columns };
    };

    const result = async <T>(param1: SQLQuery, ...param2: any[]) => {
      if (!isParamsObject(param1) && (!isTemplateStringsArray(param1) || !Array.isArray(param2))) {
        throw new Error(
          'Invalid usage of `xata.sql`. Please use it as a tagged template or with an object. If you need to bypass prepared statement protection, use `xata.sql.rawUnsafeQuery`.'
        );
      }

      return await query<T>(param1, ...param2);
    };

    result.rawUnsafeQuery = async <T>(param1: SQLQuery | string, ...param2: any[]) => {
      console.warn(
        'Calling `xata.sql.rawQuery` does not guarantee SQL injection protection. Make sure to use it as a tagged template or with an object.'
      );

      return await query<T>(param1, ...param2);
    };

    return result;
  }
}

function isTemplateStringsArray(strings: unknown): strings is TemplateStringsArray {
  return Array.isArray(strings) && 'raw' in strings && Array.isArray(strings.raw);
}

function isParamsObject(params: unknown): params is SQLQueryParams {
  return isObject(params) && 'statement' in params;
}
