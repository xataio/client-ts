import { branchTransaction, BranchTransactionPathParams, XataPluginOptions } from '@xata.io/client';
import { ImportBatchOptions } from './types';

type ImportError = { row: unknown; error: string };

export const importBatch = async (
  pathParams: BranchTransactionPathParams,
  options: ImportBatchOptions,
  pluginOptions: XataPluginOptions,
  errors?: ImportError[]
): Promise<{ successful: Awaited<ReturnType<typeof branchTransaction>>; errors?: ImportError[] }> => {
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
    const result = await branchTransaction({ ...pluginOptions, pathParams, body: { operations } });
    return { successful: result, errors };
  } catch (error: any) {
    if (error.errors) {
      const rowErrors = error.errors.filter((e: any) => e.index !== undefined);
      const errorRowIndexes = rowErrors.map((e: any) => e.index);
      const rowsToRetry = rows.filter((_row, index) => !errorRowIndexes.includes(index));
      options.batch.data = rowsToRetry;
      // what if errors twice?
      const errors = rowErrors.map((e: any) => ({ row: rows[e.index], error: e.message }));
      return importBatch(pathParams, options, pluginOptions, errors);
    }
    console.error('importBatch error', error);
    throw error;
  }
};
