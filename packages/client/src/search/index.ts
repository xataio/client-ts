import { searchBranch } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { SchemaPluginResult } from '../schema';
import { BaseData, XataRecord } from '../schema/record';
import { initObject, LinkDictionary } from '../schema/repository';
import { SelectedPick } from '../schema/selection';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';

export type SearchOptions<Schemas extends Record<string, BaseData>, Tables extends StringKeys<Schemas>> = {
  fuzziness?: number;
  tables?: Tables[];
};

export type SearchPluginResult<Schemas extends Record<string, BaseData>> = {
  all: <Tables extends StringKeys<Schemas>>(
    query: string,
    options?: SearchOptions<Schemas, Tables>
  ) => Promise<
    Values<{
      [Model in GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>]: {
        table: Model;
        record: Awaited<SelectedPick<Schemas[Model] & SearchXataRecord, ['*']>>;
      };
    }>[]
  >;
  byTable: <Tables extends StringKeys<Schemas>>(
    query: string,
    options?: SearchOptions<Schemas, Tables>
  ) => Promise<{
    [Model in GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>]?: Awaited<
      SelectedPick<Schemas[Model] & SearchXataRecord, ['*']>[]
    >;
  }>;
};

export class SearchPlugin<Schemas extends Record<string, BaseData>> extends XataPlugin {
  constructor(private db: SchemaPluginResult<Schemas>, private links: LinkDictionary) {
    super();
  }

  build({ getFetchProps }: XataPluginOptions): SearchPluginResult<Schemas> {
    return {
      all: async <Tables extends StringKeys<Schemas>>(
        query: string,
        options: SearchOptions<Schemas, Tables> = {}
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
          return { table, record: initObject(this.db, this.links, table, record) } as any;
        });
      },
      byTable: async <Tables extends StringKeys<Schemas>>(
        query: string,
        options: SearchOptions<Schemas, Tables> = {}
      ): Promise<{
        [Model in GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>]?: Awaited<
          SelectedPick<Schemas[Model] & SearchXataRecord, ['*']>[]
        >;
      }> => {
        const records = await this.#search(query, options, getFetchProps);

        return records.reduce((acc, record) => {
          const { table = 'orphan' } = record.xata;
          const items = acc[table] ?? [];
          const item = initObject(this.db, this.links, table, record);

          return { ...acc, [table]: [...items, item] };
        }, {} as any);
      }
    };
  }

  async #search<Tables extends StringKeys<Schemas>>(
    query: string,
    options: { fuzziness?: number; tables?: Tables[] },
    getFetchProps: XataPluginOptions['getFetchProps']
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
