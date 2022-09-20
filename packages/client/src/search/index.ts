import type { Schemas } from '../api';
import { getBranchDetails, searchBranch } from '../api';
import { FuzzinessExpression, HighlightExpression, PrefixExpression } from '../api/schemas';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { SchemaPluginResult } from '../schema';
import { Filter } from '../schema/filters';
import { BaseData, XataRecord, XataRecordMetadata } from '../schema/record';
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
};

export type SearchPluginResult<Schemas extends Record<string, BaseData>> = {
  all: <Tables extends StringKeys<Schemas>>(
    query: string,
    options?: SearchOptions<Schemas, Tables>
  ) => Promise<
    Values<{
      [Model in ExtractTables<
        Schemas,
        Tables,
        GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>
      >]: {
        table: Model;
        record: Awaited<SearchXataRecord<SelectedPick<Schemas[Model] & XataRecord, ['*']>>>;
      };
    }>[]
  >;
  byTable: <Tables extends StringKeys<Schemas>>(
    query: string,
    options?: SearchOptions<Schemas, Tables>
  ) => Promise<{
    [Model in ExtractTables<
      Schemas,
      Tables,
      GetArrayInnerType<NonNullable<NonNullable<typeof options>['tables']>>
    >]?: Awaited<SearchXataRecord<SelectedPick<Schemas[Model] & XataRecord, ['*']>>[]>;
  }>;
};

export class SearchPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  #schemaTables?: Schemas.Table[];

  constructor(private db: SchemaPluginResult<Schemas>, schemaTables?: Schemas.Table[]) {
    super();
    this.#schemaTables = schemaTables;
  }

  build({ getFetchProps }: XataPluginOptions): SearchPluginResult<Schemas> {
    return {
      all: async <Tables extends StringKeys<Schemas>>(query: string, options: SearchOptions<Schemas, Tables> = {}) => {
        const records = await this.#search(query, options, getFetchProps);
        const schemaTables = await this.#getSchemaTables(getFetchProps);

        return records.map((record) => {
          const { table = 'orphan' } = record.xata;

          // TODO: Search endpoint doesn't support column selection
          return { table, record: initObject(this.db, schemaTables, table, record, ['*']) } as any;
        });
      },
      byTable: async <Tables extends StringKeys<Schemas>>(
        query: string,
        options: SearchOptions<Schemas, Tables> = {}
      ) => {
        const records = await this.#search(query, options, getFetchProps);
        const schemaTables = await this.#getSchemaTables(getFetchProps);

        return records.reduce((acc, record) => {
          const { table = 'orphan' } = record.xata;

          const items = acc[table] ?? [];
          // TODO: Search endpoint doesn't support column selection
          const item = initObject(this.db, schemaTables, table, record, ['*']);

          return { ...acc, [table]: [...items, item] };
        }, {} as any);
      }
    };
  }

  async #search<Tables extends StringKeys<Schemas>>(
    query: string,
    options: SearchOptions<Schemas, Tables>,
    getFetchProps: XataPluginOptions['getFetchProps']
  ) {
    const fetchProps = await getFetchProps();
    const { tables, fuzziness, highlight, prefix } = options ?? {};

    const { records } = await searchBranch({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}' },
      // @ts-ignore https://github.com/xataio/client-ts/issues/313
      body: { tables, query, fuzziness, prefix, highlight },
      ...fetchProps
    });

    return records;
  }

  async #getSchemaTables(getFetchProps: XataPluginOptions['getFetchProps']): Promise<Schemas.Table[]> {
    if (this.#schemaTables) return this.#schemaTables;
    const fetchProps = await getFetchProps();

    const { schema } = await getBranchDetails({
      pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}' },
      ...fetchProps
    });

    this.#schemaTables = schema.tables;
    return schema.tables;
  }
}

export type SearchXataRecord<Record extends XataRecord> = Omit<Record, 'getMetadata'> & {
  getMetadata: () => XataRecordMetadata & SearchExtraProperties;
};

type SearchExtraProperties = {
  /*
   * The record's table name. APIs that return records from multiple tables will set this field accordingly.
   */
  table: string;
  /*
   * Highlights of the record. This is used by the search APIs to indicate which fields and parts of the fields have matched the search.
   */
  highlight?: {
    [key: string]:
      | string[]
      | {
          [key: string]: any;
        };
  };
  /*
   * The record's relevancy score. This is returned by the search APIs.
   */
  score?: number;
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
