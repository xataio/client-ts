import { BranchTransactionPathParams, Schemas, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { parseCsv, parseNdJson, parseJson } from './parser';
import { parseCsvFileStreamSync, parseCsvFileStream } from './streamParser';
import { importBatch } from './importer';
import { ImportBatchOptions } from './types';
import { findTable, TableInfo } from './processor';

export class XataImportPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions) {
    return {
      parseCsvFileStreamSync,
      parseCsvFileStream,
      parseJson,
      parseNdJson,
      parseCsv,
      // uses transactions API to insert 1000 rows. Either succeeds or...
      // N rows have errors, calls onBatchError with the errors,
      // then continues by calling getNextRows(N) to get the batch back up to 1000
      importBatch: (branchTransactionPathParams: BranchTransactionPathParams, options: ImportBatchOptions) =>
        importBatch(branchTransactionPathParams, options, pluginOptions),
      findTable: (tableInfo: TableInfo): Promise<Schemas.Table | undefined> => findTable(tableInfo, pluginOptions)
    };
  }
}
