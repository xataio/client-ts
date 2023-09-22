import { branchTransaction, putFile, Schemas, XataPluginOptions } from '@xata.io/client';
import { ImportBatchOptions, ImportError, ImportFilesOptions } from './types';
import { delay } from './utils/delay';

export const importBatch = async (
  location: { workspace: string; region: string; database: string; branch: string },
  options: ImportBatchOptions,
  pluginOptions: XataPluginOptions,
  errors?: ImportError[],
  maxRetries = 10,
  retries = 0
): Promise<{ successful: Awaited<ReturnType<typeof branchTransaction>>; errors?: ImportError[] }> => {
  const { batchRows } = options;
  const operations: Schemas.TransactionOperation[] = batchRows.map((row) => {
    return {
      insert: {
        table: options.table,
        record: row as Record<string, unknown>
      }
    };
  });

  try {
    const result = await branchTransaction({
      ...pluginOptions,
      pathParams: {
        workspace: location.workspace,
        region: location.region,
        // @ts-expect-error It seems that database is required
        database: location.database,
        dbBranchName: `${location.database}:${location.branch}`
      },
      body: { operations }
    });

    return { successful: result, errors };
  } catch (error: any) {
    if (error.errors) {
      const rowErrors = error.errors.filter((e: any) => e.index !== undefined);
      const errorRowIndexes = rowErrors.map((e: any) => e.index);
      const rowsToRetry = batchRows.filter((_row, index) => !errorRowIndexes.includes(index));
      // TODO: Control if it errors twice
      const errors = rowErrors.map((e: any) => ({ row: batchRows[e.index], error: e.message, index: e.index }));
      return importBatch(location, { ...options, batchRows: rowsToRetry }, pluginOptions, errors, maxRetries, retries);
    }
    if (retries < maxRetries) {
      // Exponential backoff
      await delay(1000 * 2 ** retries);
      return importBatch(location, options, pluginOptions, errors, maxRetries, retries + 1);
    }

    throw error;
  }
};

export const importFiles = async (
  location: { workspace: string; region: string; database: string; branch: string },
  options: ImportFilesOptions,
  pluginOptions: XataPluginOptions
) => {
  const { table, files, ids } = options;

  for (const index in files) {
    const row = files[index];
    const recordId = ids[index];

    for (const [columnName, value] of Object.entries(row)) {
      const files = Array.isArray(value) ? value : [value];
      for (const file of files) {
        try {
          await putFile({
            ...pluginOptions,
            pathParams: {
              workspace: location.workspace,
              dbBranchName: `${location.database}:${location.branch}`,
              region: location.region,
              tableName: table,
              recordId,
              columnName
            },
            body: file.toBlob(),
            headers: { 'Content-Type': file.mediaType ?? 'application/octet-stream' }
          });
        } catch (error) {
          // If the file upload fails, we ignore it and continue with the next file
          // TODO: Catch errors and return them
        }
      }
    }
  }
};
