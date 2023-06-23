import { getBranchDetails, Schemas, XataPluginOptions } from '@xata.io/client';

export type TableInfo = {
  workspace: string;
  region: string;
  database: string;
  branch: string;
  table: string;
};

export const findTable = async (
  tableInfo: TableInfo,
  xataPluginOptions: XataPluginOptions
): Promise<Schemas.Table | undefined> => {
  const { workspace, region, database, branch, table } = tableInfo;
  const dbBranchName = `${database}:${branch}`;
  const branchDetails = await getBranchDetails({
    // @ts-ignore
    pathParams: { workspace, dbBranchName, region, database },
    ...xataPluginOptions
  });
  const { tables } = branchDetails.schema;
  return tables.find((t) => t.name === table);
};
