import { FilterExpression } from '../api/schemas';
import { Dictionary, ExactlyOne, SingleOrArray, StringKeys } from '../util/types';
import { XataRecord } from './record';
import { ColumnsByValue, SelectableColumn } from './selection';
import { SortFilter } from './sorting';

export type SummarizeExpression<O extends XataRecord> = ExactlyOne<{
  // DAN: [question] Do we allow link.* here?
  count: ColumnsByValue<O, any> | '*';
}>;

// TODO: THIS IS NOT CORRECT
export type SummarizeResult<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> = {
  summaries: {
    [K in keyof Expression]: SummarizeResultItem<Record, Expression[K]>;
  };
};

type SummarizeExpressionType<T extends SummarizeExpression<any>> = keyof T;

type SummarizeResultItem<
  Record extends XataRecord,
  Expression extends SummarizeExpression<Record>
> = SummarizeExpressionType<Expression> extends infer Type
  ? Type extends keyof SummarizeExpressionResultTypes
    ? SummarizeExpressionResultTypes[Type]
    : never
  : never;

type SummarizeExpressionResultTypes = {
  count: number;
};

type SummarizeColumns<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> =
  | SelectableColumn<Record>
  | StringKeys<Expression>;

export type SummarizeParams<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> = {
  summaries?: Expression;
  // TODO: Not sure about this type
  summariesFilter?: FilterExpression;
  // TODO: Not sure about this type
  filter?: FilterExpression;
  columns?: SelectableColumn<Record>[];
  sort?: SingleOrArray<SortFilter<Record, SummarizeColumns<Record, Expression>>>;
};
