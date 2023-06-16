import { Schemas, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { parseCsv, parseNdJson, parseJson } from './parser';
import {
  ImportStreamOptions,
  ParseCsvOptions,
  ParseFileStreamOptions,
  ParseJsonOptions,
  ParseNdJsonOptions,
  ParseResults,
  ParseStreamResponse
} from './types';

export class XataImportPlugin extends XataPlugin {
  build(_options: XataPluginOptions) {
    return {
      // this API works with ndjson and csv (not json)
      parseFileStream: async (options: ParseFileStreamOptions): Promise<ParseStreamResponse> => {
        return {
          getNextRows: (numberOfRows: number) => {
            // maybe don't need to table again here?
            return { success: true, columns: [], warnings: [], data: [] };
          },
          table: { name: 'something', columns: [] }
        };
      },
      parseJson,
      parseNdJson,
      parseCsv,
      // uses transactions API to insert 1000 rows. Either succeeds or...
      // N rows have errors, calls onBatchError with the errors,
      // then continues by calling getNextRows(N) to get the batch back up to 1000
      importStream: (options: ImportStreamOptions) => Promise<void>
    };
  }
}
