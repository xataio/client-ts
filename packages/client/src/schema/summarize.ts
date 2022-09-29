import { FilterExpression } from '../api/schemas';
import { Dictionary, ExactlyOne, SingleOrArray, StringKeys } from '../util/types';
import { Filter } from './filters';
import { XataRecord } from './record';
import { ColumnsByValue, SelectableColumn } from './selection';
import { SortFilter } from './sorting';

export type SummarizeExpression<O extends XataRecord> = ExactlyOne<{
  count: ColumnsByValue<O, any> | '*';
  // TODO: Add for other summarize expressions, PR not merged in the backend yet
  //min: ColumnsByValue<O, string | number | Date | any[]>;
  //max: ColumnsByValue<O, string | number | Date | any[]>;
  //sum: ColumnsByValue<O, number>;
  //avg: ColumnsByValue<O, number>;
}>;

// TODO: Always an array, infer type from selected columns and summaries
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
  // TODO: Add for other summarize expressions, PR not merged in the backend yet
  //min: any; // TODO: ValueAtColumn<Record, Path>
  //max: any; // TODO: ValueAtColumn<Record, Path>
  //sum: number;
  //avg: number;
};

type SummarizeColumns<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> =
  | SelectableColumn<Record>
  | StringKeys<Expression>;

export type SummarizeParams<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> = {
  summaries?: Expression;
  summariesFilter?: FilterExpression; // TODO: Filter<SummarizeColumns<Record, Expression>>
  filter?: Filter<Record>;
  columns?: SelectableColumn<Record>[];
  sort?: SingleOrArray<SortFilter<Record, SummarizeColumns<Record, Expression>>>;
};
