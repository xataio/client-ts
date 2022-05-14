import { searchBranch } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { BaseData, XataRecord } from '../schema/record';
import { SelectedPick } from '../schema/selection';
import { GetArrayInnerType, StringKeys } from '../util/types';

export class SearchPlugin<Schemas extends Record<string, BaseData>> extends XataPlugin {
  build({ getFetchProps }: XataPluginOptions) {
    return async <Tables extends StringKeys<Schemas>>(
      query: string,
      options?: { fuzziness?: number; tables?: Tables[] }
    ): Promise<{
      [Model in GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>]: Awaited<
        SelectedPick<Schemas[Model] & SearchXataRecord, ['*']>[]
      >;
    }> => {
      const fetchProps = await getFetchProps();
      const { tables, fuzziness } = options ?? {};

      const { records } = await searchBranch({
        pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}' },
        body: { tables, query, fuzziness },
        ...fetchProps
      });

      return records.reduce((acc, record) => {
        const { table = 'orphan' } = record.xata;
        const items = acc[table] ?? [];

        return { ...acc, [table]: [...items, record] };
      }, {} as any);
    };
  }
}

type SearchXataRecord = XataRecord & { xata: { table: string } };
