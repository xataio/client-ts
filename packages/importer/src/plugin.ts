import { Schemas, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { Importer } from './importer';
import {
  ParseStreamOptions,
  ParseCsvOptions,
  ParseFileStreamOptions,
  ParseJsonOptions,
  ParseNdJsonOptions,
  ParseResults,
  ParseStreamResponse
} from './types';

export class XataImportPlugin extends XataPlugin {
  build(_options: XataPluginOptions) {
    const importer = new Importer();

    return {
      // this API works with ndjson and csv (not json)
      parseFileStream: async (options: ParseFileStreamOptions): Promise<ParseStreamResponse> => {
        return {
          getNextRows: (numberOfRows: number) => {
            // maybe don't need to table again here?
            return { success: true, table: { name: 'something', columns: [] }, warnings: [], data: [] };
          },
          table: { name: 'something', columns: [] }
        };
      },
      parseJson: (options: Omit<ParseJsonOptions, 'strategy'>): ParseResults =>
        importer.read({ strategy: 'json', ...options }),
      parseNdjson: (options: Omit<ParseNdJsonOptions, 'strategy'>): ParseResults =>
        importer.read({ strategy: 'ndjson', ...options }),
      parseCsv: (options: Omit<ParseCsvOptions, 'strategy'>): ParseResults =>
        importer.read({ strategy: 'csv', ...options }),
      // uses transactions API to insert 1000 rows. Either succeeds or...
      // N rows have errors, calls onBatchError with the errors,
      // then continues by calling getNextRows(N) to get the batch back up to 1000
      importStream: (options: ParseStreamOptions) => Promise<void>
    };
  }
}
