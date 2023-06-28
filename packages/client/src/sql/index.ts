import { sqlQuery } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { prepareParams } from './parameters';

export type SQLQueryParams = {
  query: string;
  params: any[];
  consistency?: 'strong' | 'eventual';
};

export type SQLQuery = TemplateStringsArray | SQLQueryParams | string;

export type SQLPluginResult = <T>(
  query: SQLQuery,
  ...parameters: any[]
) => Promise<{
  records: T[];
  warning?: string;
}>;

export class SQLPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions): SQLPluginResult {
    return async <T>(param1: SQLQuery, ...param2: any[]) => {
      const { query, params, consistency } = prepareParams(param1, param2);

      const { records, warning } = await sqlQuery({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
        body: { query, params, consistency },
        ...pluginOptions
      });

      return { records: records as T[], warning };
    };
  }
}
