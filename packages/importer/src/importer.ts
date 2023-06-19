import { branchTransaction, BranchTransactionPathParams, XataPluginOptions } from '@xata.io/client';
import { ImportBatchOptions } from './types';

export const importBatch = async (
  pathParams: BranchTransactionPathParams,
  options: ImportBatchOptions,
  pluginOptions: XataPluginOptions
) => {
  if (!options.batch.success) {
    throw new Error('Batch must be successful to import');
  }
  const rows = options.batch.data;
  const operations = rows.map((row) => {
    return {
      insert: {
        table: options.table,
        record: row as { [key: string]: any }
      }
    };
  });
  try {
    return await branchTransaction({ ...pluginOptions, pathParams, body: { operations } });
  } catch (error) {
    console.log('error!', error);
    // if (e.errors) {
    //   return await branchTransaction({ ...pluginOptions, pathParams, body: { operations } });
    // }
  }
};
