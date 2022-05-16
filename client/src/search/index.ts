import { searchBranch } from '../api';
import { Namespace, NamespaceBuildOptions } from '../namespace';
import { BaseData, XataRecord } from '../schema/record';
import { SelectedPick } from '../schema/selection';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';

export class SearchNamespace<Schemas extends Record<string, BaseData>> extends Namespace {
  build({ getFetchProps }: NamespaceBuildOptions) {
    return {
      all: async <Tables extends StringKeys<Schemas>>(
        query: string,
        options: { fuzziness?: number; tables?: Tables[] } = {}
      ): Promise<
        Values<{
          [Model in GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>]: {
            table: Model;
            record: Awaited<SelectedPick<Schemas[Model] & SearchXataRecord, ['*']>>;
          };
        }>[]
      > => {
        const records = await this.#search(query, options, getFetchProps);

        return records.map((record) => {
          const { table = 'orphan' } = record.xata;
          return { table, record } as any;
        });
      },
      byTable: async <Tables extends StringKeys<Schemas>>(
        query: string,
        options: { fuzziness?: number; tables?: Tables[] } = {}
      ): Promise<{
        [Model in GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>]: Awaited<
          SelectedPick<Schemas[Model] & SearchXataRecord, ['*']>[]
        >;
      }> => {
        const records = await this.#search(query, options, getFetchProps);

        return records.reduce((acc, record) => {
          const { table = 'orphan' } = record.xata;
          const items = acc[table] ?? [];

          return { ...acc, [table]: [...items, record] };
        }, {} as any);
      }
    };
  }

  async #search<Tables extends StringKeys<Schemas>>(
    query: string,
    options: { fuzziness?: number; tables?: Tables[] },
    getFetchProps: NamespaceBuildOptions['getFetchProps']
  ) {
    const fetchProps = await getFetchProps();
    const { tables, fuzziness } = options ?? {};

    const { records } = await searchBranch({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}' },
      body: { tables, query, fuzziness },
      ...fetchProps
    });

    return records;
  }
}

type SearchXataRecord = XataRecord & { xata: { table: string } };
