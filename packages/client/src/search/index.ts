import { Responses, searchBranch } from '../api';
import { FuzzinessExpression, HighlightExpression, PrefixExpression, SearchPageConfig } from '../api/schemas';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { DatabaseSchema, SchemaInference, SchemaPluginResult } from '../schema';
import { Filter } from '../schema/filters';
import { BaseData, XataRecord } from '../schema/record';
import { initObject } from '../schema/repository';
import { SelectedPick } from '../schema/selection';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';
import { Boosters } from './boosters';
import { TargetColumn } from './target';

export type SearchOptions<Schemas extends Record<string, BaseData>, Tables extends StringKeys<Schemas>> = {
  fuzziness?: FuzzinessExpression;
  prefix?: PrefixExpression;
  highlight?: HighlightExpression;
  tables?: Array<
    | Tables
    | Values<{
        [Model in GetArrayInnerType<NonNullable<Tables[]>>]: {
          table: Model;
          target?: TargetColumn<Schemas[Model] & XataRecord>[];
          filter?: Filter<SelectedPick<Schemas[Model] & XataRecord, ['*']>>;
          boosters?: Boosters<Schemas[Model] & XataRecord>[];
        };
      }>
  >;
  page?: SearchPageConfig;
};

export type TotalCount = Pick<Responses.SearchResponse, 'totalCount'>;

export type SearchPluginResult<Schemas extends Record<string, BaseData>> = {
  all: <Tables extends StringKeys<Schemas>>(
    query: string,
    options?: SearchOptions<Schemas, Tables>
  ) => Promise<
    TotalCount & {
      records: Values<{
        [Model in ExtractTables<
          Schemas,
          Tables,
          GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>
        >]: {
          table: Model;
          record: Awaited<SearchXataRecord<SelectedPick<Schemas[Model] & XataRecord, ['*']>>>;
        };
      }>[];
    }
  >;
  byTable: <Tables extends StringKeys<Schemas>>(
    query: string,
    options?: SearchOptions<Schemas, Tables>
  ) => Promise<
    TotalCount & {
      records: {
        [Model in ExtractTables<
          Schemas,
          Tables,
          GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>
        >]?: Awaited<SearchXataRecord<SelectedPick<Schemas[Model] & XataRecord, ['*']>>[]>;
      };
    }
  >;
};

export class SearchPlugin<Schema extends DatabaseSchema> extends XataPlugin {
  constructor(private db: SchemaPluginResult<Schema>) {
    super();
  }

  build(pluginOptions: XataPluginOptions): SearchPluginResult<SchemaInference<Schema['tables']>> {
    return {
      all: async <Tables extends StringKeys<SchemaInference<Schema['tables']>>>(
        query: string,
        options: SearchOptions<SchemaInference<Schema['tables']>, Tables> = {}
      ) => {
        const { records, totalCount } = await this.#search(query, options, pluginOptions);

        return {
          totalCount,
          records: records.map((record) => {
            const table = record.xata_table;

            // TODO: Search endpoint doesn't support column selection
            return { table, record: initObject(this.db, pluginOptions.schema, table, record, ['*']) } as any;
          })
        };
      },
      byTable: async <Tables extends StringKeys<SchemaInference<Schema['tables']>>>(
        query: string,
        options: SearchOptions<SchemaInference<Schema['tables']>, Tables> = {}
      ) => {
        const { records: rawRecords, totalCount } = await this.#search(query, options, pluginOptions);

        const records = rawRecords.reduce((acc, record) => {
          const table = record.xata_table;

          const items = acc[table] ?? [];
          // TODO: Search endpoint doesn't support column selection
          const item = initObject(this.db, pluginOptions.schema, table, record, ['*']);

          return { ...acc, [table]: [...items, item] };
        }, {} as any);
        return { totalCount, records };
      }
    };
  }

  async #search<Tables extends StringKeys<SchemaInference<Schema['tables']>>>(
    query: string,
    options: SearchOptions<SchemaInference<Schema['tables']>, Tables>,
    pluginOptions: XataPluginOptions
  ) {
    const { tables, fuzziness, highlight, prefix, page } = options ?? {};

    const { records, totalCount } = await searchBranch({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
      // @ts-expect-error Filter properties do not match inferred type
      body: { tables, query, fuzziness, prefix, highlight, page },
      ...pluginOptions
    });

    return { records, totalCount };
  }
}

export type SearchXataRecord<Record extends XataRecord> = Record & SearchExtraProperties;

type SearchExtraProperties = {
  /*
   * The record's table name. APIs that return records from multiple tables will set this field accordingly.
   */
  xata_table: string;
  /*
   * Highlights of the record. This is used by the search APIs to indicate which fields and parts of the fields have matched the search.
   */
  xata_highlight?: {
    [key: string]:
      | string[]
      | {
          [key: string]: any;
        };
  };
  /*
   * The record's relevancy score. This is returned by the search APIs.
   */
  xata_score?: number;
};

type ReturnTable<Table, Tables> = Table extends Tables ? Table : never;

type ExtractTables<
  Schemas extends Record<string, BaseData>,
  Tables extends StringKeys<Schemas>,
  TableOptions extends GetArrayInnerType<NonNullable<NonNullable<SearchOptions<Schemas, Tables>>['tables']>>
> = TableOptions extends `${infer Table}`
  ? ReturnTable<Table, Tables>
  : TableOptions extends { table: infer Table }
  ? ReturnTable<Table, Tables>
  : never;
