import { Dictionary, ExactlyOne, SingleOrArray, StringKeys } from '../util/types';
import { Filter } from './filters';
import { XataRecord } from './record';
import { ColumnsByValue, SelectableColumn, SelectedPick } from './selection';
import { SortFilter } from './sorting';

export type SummarizeExpression<O extends XataRecord> = ExactlyOne<{
  count: ColumnsByValue<O, any> | '*';
  // TODO: Add for other summarize expressions, PR not merged in the backend yet
  //min: ColumnsByValue<O, string | number | Date | any[]>;
  //max: ColumnsByValue<O, string | number | Date | any[]>;
  //sum: ColumnsByValue<O, number>;
  //avg: ColumnsByValue<O, number>;
}>;

export type SummarizeParams<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>,
  Columns extends SelectableColumn<Record>[]
> = {
  summaries?: Expression;
  summariesFilter?: SummariesFilter<Record, Expression>;
  filter?: Filter<Record>;
  columns?: Columns;
  sort?: SummarizeSort<Record, Expression>;
};

export type SummarizeResult<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>,
  Columns extends SelectableColumn<Record>[]
> = {
  summaries: SummarizeResultItem<Record, Expression, Columns>[];
};

type SummarizeResultItem<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>,
  Columns extends SelectableColumn<Record>[]
> = {
  [K in StringKeys<Expression>]: StringKeys<Expression[K]> extends keyof SummarizeExpressionResultTypes
    ? SummarizeExpressionResultTypes[StringKeys<Expression[K]>]
    : never;
} & SelectedPick<Record, Columns>;

type SummarizeExpressionResultTypes = {
  count: number;
  // TODO: Add for other summarize expressions, PR not merged in the backend yet
  //min: any; // TODO: ValueAtColumn<Record, Path>
  //max: any; // TODO: ValueAtColumn<Record, Path>
  //sum: number;
  //avg: number;
};

type SummarizeSort<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>
> = SingleOrArray<SortFilter<Record, SelectableColumn<Record> | StringKeys<Expression>>>;

type SummariesFilter<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> = Filter<{
  [K in StringKeys<Expression>]: StringKeys<Expression[K]> extends infer SummarizeOperation
    ? SummarizeOperation extends keyof SummarizeExpressionResultTypes
      ? SummarizeExpressionResultTypes[SummarizeOperation]
      : never
    : never;
}>;
