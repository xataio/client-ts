import { XataPlugin, XataPluginOptions } from '@xata.io/client';
import { parseCsvStream, parseCsvStreamBatches } from './csvStreamParser';
import { importBatch, importFiles } from './importer';
import { ImportBatchOptions, ImportFilesOptions } from './types';

export class XataImportPlugin extends XataPlugin {
  build(pluginOptions: XataPluginOptions) {
    return {
      parseCsvStream,
      parseCsvStreamBatches,
      importBatch: (
        location: { workspace: string; region: string; database: string; branch: string },
        options: ImportBatchOptions
      ) => importBatch(location, options, pluginOptions),
      importFiles: (
        location: { workspace: string; region: string; database: string; branch: string },
        options: ImportFilesOptions
      ) => importFiles(location, options, pluginOptions)
    };
  }
}
