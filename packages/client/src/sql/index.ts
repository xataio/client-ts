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

export type SQLPluginResult = <T>(
  query: SQLQuery,
  ...parameters: any[]
) => Promise<{
  records: T[];
  columns?: Record<string, { type_name: string }>;
  warning?: string;
}>;

export class SQLPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions): SQLPluginResult {
    return async <T>(param1: SQLQuery, ...param2: any[]) => {
      if (!isParamsObject(param1) && (!isTemplateStringsArray(param1) || !Array.isArray(param2))) {
        throw new Error(
          'Calling `xata.sql` as a function is not safe. Make sure to use it as a tagged template or with an object.'
        );
      }

      const { statement, params, consistency } = prepareParams(param1, param2);

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
  return Array.isArray(strings) && 'raw' in strings && Array.isArray(strings.raw);
}

function isParamsObject(params: unknown): params is SQLQueryParams {
  return isObject(params) && 'statement' in params;
}
