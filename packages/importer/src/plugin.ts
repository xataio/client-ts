import { XataPlugin, XataPluginOptions } from '@xata.io/client';
import {
  ImportCsvOptions,
  Importer,
  ImportFileOptions,
  ImportJsonOptions,
  ImportNdJsonOptions,
  ImportUrlOptions
} from './importer';

export class XataImportPlugin extends XataPlugin {
  build(_options: XataPluginOptions) {
    const importer = new Importer();

    return {
      read: {
        file: (options: Omit<ImportFileOptions, 'strategy'>) => importer.read({ strategy: 'file', ...options }),
        url: (options: Omit<ImportUrlOptions, 'strategy'>) => importer.read({ strategy: 'url', ...options }),
        json: (options: Omit<ImportJsonOptions, 'strategy'>) => importer.read({ strategy: 'json', ...options }),
        ndjson: (options: Omit<ImportNdJsonOptions, 'strategy'>) => importer.read({ strategy: 'ndjson', ...options }),
        csv: (options: Omit<ImportCsvOptions, 'strategy'>) => importer.read({ strategy: 'csv', ...options })
      },
      import: {
        file: (options: Omit<ImportFileOptions, 'strategy'>) => importer.import({ strategy: 'file', ...options }),
        url: (options: Omit<ImportUrlOptions, 'strategy'>) => importer.import({ strategy: 'url', ...options }),
        json: (options: Omit<ImportJsonOptions, 'strategy'>) => importer.import({ strategy: 'json', ...options }),
        ndjson: (options: Omit<ImportNdJsonOptions, 'strategy'>) => importer.import({ strategy: 'ndjson', ...options }),
        csv: (options: Omit<ImportCsvOptions, 'strategy'>) => importer.import({ strategy: 'csv', ...options })
      }
    };
  }
}
