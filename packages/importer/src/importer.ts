import { branchTransaction, putFile, XataPluginOptions } from '@xata.io/client';
import { ImportBatchOptions, ImportError, ImportFilesOptions, ImportLocation } from './types';
import { delay } from './utils/delay';

export const importBatch = async (
  location: ImportLocation,
  options: ImportBatchOptions,
  pluginOptions: XataPluginOptions,
  errors?: ImportError[],
  maxRetries = 10,
  retries?: number
): Promise<{ ids: Array<string | null>; errors?: ImportError[] }> => {
  if (!retries) retries = 0;
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
    const { results } = await branchTransaction({
      ...pluginOptions,
      pathParams: {
        workspace: location.workspace,
        region: location.region,
        dbBranchName: `${location.database}:${location.branch}`,
        // @ts-expect-error For some reason, database is required...
        database: location.database
      },
      body: { operations }
    });

    const ids = results.map((r) => ('id' in r ? r.id : null));

    return { ids, errors };
  } catch (error: any) {
    if (error.errors) {
      const rowErrors = error.errors.filter((e: any) => e.index !== undefined);
      const errorRowIndexes = rowErrors.map((e: any) => e.index);
      const rowsToRetry = batchRows.filter((_row, index) => !errorRowIndexes.includes(index));

      // what if errors twice?
      const errors = rowErrors.map((e: any) => ({ row: batchRows[e.index], error: e.message, index: e.index }));
      if (retries < maxRetries) {
        return importBatch(
          location,
          { ...options, batchRows: rowsToRetry },
          pluginOptions,
          errors,
          maxRetries,
          retries + 1
        );
      }
    }
    if (retries < maxRetries) {
      // exponential backoff
      await delay(1000 * 2 ** retries);
      return importBatch(location, options, pluginOptions, errors, maxRetries, retries + 1);
    }

    throw error;
  }
};

export const importFiles = async (
  location: ImportLocation,
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
        try {
          await putFile({
            ...pluginOptions,
            pathParams: {
              workspace: workspace,
              // @ts-expect-error For some reason we need to send it
              database: database,
              branch: branch,
              region: region,
              tableName: table,
              recordId: record ?? '',
              columnName: columnName.trim()
            },
            body: file.toBlob(),
            headers: { 'Content-Type': file.mediaType ?? 'application/octet-stream' }
          });
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
};
