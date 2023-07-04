import { BranchTransactionPathParams, Schemas, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { parseCsvStreamBatches, parseCsvStream } from './csvStreamParser';
import { importBatch } from './importer';
import { ImportBatchOptions } from './types';
import { findTable, TableInfo } from './processor';

export class XataImportPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions) {
    return {
      parseCsvStream,
      parseCsvStreamBatches,
      importBatch: (branchTransactionPathParams: BranchTransactionPathParams, options: ImportBatchOptions) =>
        importBatch(branchTransactionPathParams, options, pluginOptions),
      // remove this?
      findTable: (tableInfo: TableInfo): Promise<Schemas.Table | undefined> => findTable(tableInfo, pluginOptions)
    };
  }
}
