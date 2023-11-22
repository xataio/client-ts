import { XataPlugin, XataPluginOptions } from '@xata.io/client';
import { parseCsvStream, parseCsvStreamBatches } from './csvStreamParser';
import { importBatch, importFiles } from './importer';
import { ImportBatchOptions, ImportLocation, ImportFilesOptions } from './types';

export class XataImportPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions) {
    return {
      parseCsvStream,
      parseCsvStreamBatches,
      importBatch: (location: ImportLocation, options: ImportBatchOptions) =>
        importBatch(location, options, pluginOptions),
      importFiles: (location: ImportLocation, options: ImportFilesOptions) =>
        importFiles(location, options, pluginOptions)
    };
  }
}
