import { BranchTransactionPathParams, Schemas, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { parseJson } from './parser';
import { parseCsvStreamBatches, parseCsvStream } from './streamParser';
import { importBatch } from './importer';
import { ImportBatchOptions } from './types';
import { findTable, TableInfo } from './processor';

export class XataImportPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions) {
    return {
      parseCsvStream,
      parseCsvStreamBatches,
      parseJson,
      importBatch: (branchTransactionPathParams: BranchTransactionPathParams, options: ImportBatchOptions) =>
        importBatch(branchTransactionPathParams, options, pluginOptions),
      findTable: (tableInfo: TableInfo): Promise<Schemas.Table | undefined> => findTable(tableInfo, pluginOptions)
    };
  }
}
