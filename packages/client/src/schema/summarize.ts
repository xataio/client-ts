import { Dictionary, ExactlyOne, SingleOrArray, StringKeys } from '../util/types';
import { Filter } from './filters';
import { XataRecord } from './record';
import { ColumnsByValue, SelectableColumn, SelectedPick, ValueAtColumn } from './selection';
import { SortFilter } from './sorting';

export type SummarizeExpression<O extends XataRecord> = ExactlyOne<{
  count: ColumnsByValue<O, any> | '*';
  min: ColumnsByValue<O, string | number | Date | any[]>;
  max: ColumnsByValue<O, string | number | Date | any[]>;
  sum: ColumnsByValue<O, number>;
  avg: ColumnsByValue<O, number>;
}>;

export type SummarizeParams<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>,
  Columns extends SelectableColumn<Record>[]
> = {
  summaries?: Expression;
  summariesFilter?: SummarizeFilter<Record, Expression>;
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

type SummarizeExpressionResultTypes<Value> = {
  count: number;
  min: Value;
  max: Value;
  sum: number;
  avg: number;
};

type SummarizeSort<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>
> = SingleOrArray<SortFilter<Record, SelectableColumn<Record> | StringKeys<Expression>>>;

type SummarizeValuePick<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> = {
  [K in StringKeys<Expression>]: StringKeys<Expression[K]> extends infer SummarizeOperation
    ? SummarizeOperation extends keyof Expression[K]
      ? Expression[K][SummarizeOperation] extends infer Column
        ? Column extends SelectableColumn<Record>
          ? SummarizeOperation extends keyof SummarizeExpressionResultTypes<any>
            ? SummarizeExpressionResultTypes<ValueAtColumn<Record, Column>>[SummarizeOperation]
            : never
          : never
        : never
      : never
    : never;
};

type SummarizeFilter<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>
> = Filter<Record> & Filter<SummarizeValuePick<Record, Expression>>;

type SummarizeResultItem<
  Record extends XataRecord,
  Expression extends Dictionary<SummarizeExpression<Record>>,
  Columns extends SelectableColumn<Record>[]
> = SummarizeValuePick<Record, Expression> & SelectedPick<Record, Columns>;
