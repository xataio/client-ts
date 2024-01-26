import { sqlQuery } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { prepareParams } from './parameters';

export type SQLQueryParams<T = any[]> = {
  statement: string;
  params?: T;
  consistency?: 'strong' | 'eventual';
};

export type SQLQuery = TemplateStringsArray | SQLQueryParams | string;

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
