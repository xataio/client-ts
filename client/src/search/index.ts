import { searchBranch } from '../api';
import { Namespace, NamespaceBuildOptions } from '../namespace';
import { BaseData, XataRecord } from '../schema/record';
import { SelectedPick } from '../schema/selection';
import { GetArrayInnerType, StringKeys } from '../util/types';

export class SearchNamespace<Schemas extends Record<string, BaseData>> extends Namespace {
  build({ getFetchProps }: NamespaceBuildOptions) {
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
