import { branchTransaction, BranchTransactionPathParams, putFile, XataFile, XataPluginOptions } from '@xata.io/client';
import { ImportBatchOptions, ImportError, ImportFilesOptions } from './types';
import { delay } from './utils/delay';

// todo: tests

export const importBatch = async (
  pathParams: BranchTransactionPathParams,
  options: ImportBatchOptions,
  pluginOptions: XataPluginOptions,
  errors?: ImportError[],
  maxRetries = 10,
  retries = 0
): Promise<{ successful: Awaited<ReturnType<typeof branchTransaction>>; errors?: ImportError[] }> => {
  const { batchRows } = options;
  const operations = batchRows.map((row) => {
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
      const rowsToRetry = batchRows.filter((_row, index) => !errorRowIndexes.includes(index));
      // what if errors twice?
      const errors = rowErrors.map((e: any) => ({ row: batchRows[e.index], error: e.message, index: e.index }));
      return importBatch(
        pathParams,
        { ...options, batchRows: rowsToRetry },
        pluginOptions,
        errors,
        maxRetries,
        retries
      );
    }
    if (retries < maxRetries) {
      // exponential backoff
      await delay(1000 * 2 ** retries);
      return importBatch(pathParams, options, pluginOptions, errors, maxRetries, retries + 1);
    }

    throw error;
  }
};

export const importFiles = async (
  location: { workspace: string; region: string; database: string; branch: string },
  options: ImportFilesOptions,
  pluginOptions: XataPluginOptions
) => {
  const { workspace, database, region, branch } = location;
  const { table, ids, files } = options;

  for (const index in files) {
    const row = files[index];
    const record = ids[index];

    for (const [columnName, value] of Object.entries(row)) {
      const files = Array.isArray(value) ? value : [value];
      for (const file of files) {
        const fileBlob = XataFile.fromBase64(file.base64Content, { mediaType: file.mediaType, name: file.name });
        try {
          await putFile({
            ...pluginOptions,
            pathParams: {
              workspace: workspace,
              database: database,
              branch: branch,
              region: region,
              tableName: table,
              recordId: record,
              columnName
            },
            body: fileBlob.toBlob(),
            headers: { 'Content-Type': file.mediaType ?? 'application/octet-stream' }
          });
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
};
