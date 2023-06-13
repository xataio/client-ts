import { XataPlugin, XataPluginOptions } from '@xata.io/client';
import { Importer } from './importer';
import { ImportCsvOptions, ImportFileOptions, ImportJsonOptions, ImportNdJsonOptions } from './types';

export class XataImportPlugin extends XataPlugin {
  build(_options: XataPluginOptions) {
    const importer = new Importer();

    return {
      file: (options: Omit<ImportFileOptions, 'strategy'>) => importer.read({ strategy: 'file', ...options }),
      json: (options: Omit<ImportJsonOptions, 'strategy'>) => importer.read({ strategy: 'json', ...options }),
      ndjson: (options: Omit<ImportNdJsonOptions, 'strategy'>) => importer.read({ strategy: 'ndjson', ...options }),
      csv: (options: Omit<ImportCsvOptions, 'strategy'>) => importer.read({ strategy: 'csv', ...options })
    };
  }
}
