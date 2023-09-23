import { BranchTransactionPathParams, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { parseCsvStreamBatches, parseCsvStream } from './csvStreamParser';
import { importBatch, importFiles } from './importer';
import { ImportBatchOptions, ImportFilesOptions } from './types';

export class XataImportPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions) {
    return {
      parseCsvStream,
      parseCsvStreamBatches,
      importBatch: (branchTransactionPathParams: BranchTransactionPathParams, options: ImportBatchOptions) =>
        importBatch(branchTransactionPathParams, options, pluginOptions),
      importFiles: (
        location: { workspace: string; region: string; database: string; branch: string },
        options: ImportFilesOptions
      ) => importFiles(location, options, pluginOptions)
    };
  }
}
